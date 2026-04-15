require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const JWT_SECRET = process.env.JWT_SECRET

// POST /login
// POST /login — agrega el JOIN con user_permissions
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
  const user = result.rows[0]

  if (!user) return res.status(401).json({ message: 'Usuario no encontrado' })
  if (user.contraseña !== password) return res.status(401).json({ message: 'Contraseña incorrecta' })

  // ✅ Traer permisos del usuario desde user_permissions + permissions
  const permsResult = await pool.query(`
    SELECT p.permission_key
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = $1
  `, [user.id])

  const permissions = permsResult.rows.map(r => r.permission_key)

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  )

  const { contraseña, ...userSinPassword } = user
  res.json({ token, user: { ...userSinPassword, permissions } })
})

// POST /register
app.post('/register', async (req, res) => {
  const { name, email, calle, colonia, no_exterior, telefono, password } = req.body

  const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email])
  if (exists.rows[0]) return res.status(400).json({ message: 'El email ya está registrado' })

  const result = await pool.query(
    `INSERT INTO users (name, email, calle, colonia, no_exterior, telefono, contraseña)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, email, calle, colonia, no_exterior, telefono, active, created_at`,
    [name, email, calle, colonia, no_exterior, telefono, password]
  )
  res.status(201).json(result.rows[0])
})

// GET /
// GET / → con permisos
app.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, calle, colonia, no_exterior, telefono, active, created_at FROM users'
  )

  // Para cada usuario, traer sus permisos
  const users = await Promise.all(result.rows.map(async (user) => {
    const permsResult = await pool.query(`
      SELECT p.permission_key
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = $1
    `, [user.id])
    return { ...user, permissions: permsResult.rows.map(r => r.permission_key) }
  }))

  res.json(users)
})

// GET /:id
app.get('/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, calle, colonia, no_exterior, telefono, active, created_at FROM users WHERE id = $1',
    [req.params.id]
  )
  if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' })

  // Traer permisos del usuario
  const permsResult = await pool.query(`
    SELECT p.permission_key
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = $1
  `, [req.params.id])

  res.json({ 
    ...result.rows[0], 
    permissions: permsResult.rows.map(r => r.permission_key) 
  })
})

// PUT /:id
app.put('/:id', async (req, res) => {
  const { name, email, calle, colonia, no_exterior, telefono, active } = req.body
  const result = await pool.query(
    `UPDATE users SET name=$1, email=$2, calle=$3, colonia=$4, no_exterior=$5, telefono=$6, active=$7
     WHERE id=$8
     RETURNING id, name, email, calle, colonia, no_exterior, telefono, active, created_at`,
    [name, email, calle, colonia, no_exterior, telefono, active, req.params.id]
  )
  if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' })
  res.json(result.rows[0])
})

// DELETE /:id
app.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id', [req.params.id])
  if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' })
  res.json({ message: 'Usuario eliminado' })
})

// PUT /users/:id/permissions
app.put('/:id/permissions', async (req, res) => {
  const { permissions } = req.body  // array de permission_keys

  // Borrar permisos actuales
  await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [req.params.id])

  if (permissions.length > 0) {
    // Buscar los IDs de los permisos
    const permsResult = await pool.query(
      `SELECT id, permission_key FROM permissions WHERE permission_key = ANY($1)`,
      [permissions]
    )

    // Insertar nuevos permisos
    for (const perm of permsResult.rows) {
      await pool.query(
        'INSERT INTO user_permissions (user_id, permission_id) VALUES ($1, $2)',
        [req.params.id, perm.id]
      )
    }
  }

  res.json({ message: 'Permisos actualizados' })
})

app.listen(process.env.PORT, () => console.log(`Users API en puerto ${process.env.PORT}`))