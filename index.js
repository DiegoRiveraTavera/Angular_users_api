require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const JWT_SECRET = process.env.JWT_SECRET

// POST /login
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
  const user = result.rows[0]

  if (!user) return res.status(401).json({ message: 'Usuario no encontrado' })
  if (user.contraseña !== password) return res.status(401).json({ message: 'Contraseña incorrecta' })

  // ✅ Generar JWT con el id del usuario
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  )

  const { contraseña, ...userSinPassword } = user
  res.json({ token, user: userSinPassword })
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
app.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, calle, colonia, no_exterior, telefono, active, created_at FROM users'
  )
  res.json(result.rows)
})

// GET /:id
app.get('/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, calle, colonia, no_exterior, telefono, active, created_at FROM users WHERE id = $1',
    [req.params.id]
  )
  if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' })
  res.json(result.rows[0])
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

app.listen(process.env.PORT, () => console.log(`Users API en puerto ${process.env.PORT}`))