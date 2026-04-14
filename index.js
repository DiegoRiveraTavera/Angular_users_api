require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')

const app = express()
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// POST /login → gateway: localhost:4000/users/login
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1', [email]
  )
  const user = result.rows[0]

  if (!user) return res.status(401).json({ message: 'Usuario no encontrado' })
  if (user.contraseña !== password) return res.status(401).json({ message: 'Contraseña incorrecta' })

  const { contraseña, ...userSinPassword } = user
  res.json(userSinPassword)
})

// GET / → gateway: localhost:4000/users
app.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, calle, colonia, no_exterior, telefono, active, created_at FROM users'
  )
  res.json(result.rows)
})

// GET /:id → gateway: localhost:4000/users/:id
app.get('/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, calle, colonia, no_exterior, telefono, active, created_at FROM users WHERE id = $1',
    [req.params.id]
  )
  if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' })
  res.json(result.rows[0])
})

// PUT /:id → gateway: localhost:4000/users/:id
app.put('/:id', async (req, res) => {
  const { name, email, calle, colonia, no_exterior, telefono, active } = req.body

  const result = await pool.query(
    `UPDATE users 
     SET name = $1, email = $2, calle = $3, colonia = $4, 
         no_exterior = $5, telefono = $6, active = $7
     WHERE id = $8
     RETURNING id, name, email, calle, colonia, no_exterior, telefono, active, created_at`,
    [name, email, calle, colonia, no_exterior, telefono, active, req.params.id]
  )

  if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' })
  res.json(result.rows[0])
})

// DELETE /:id → gateway: localhost:4000/users/:id
app.delete('/:id', async (req, res) => {
  const result = await pool.query(
    'DELETE FROM users WHERE id = $1 RETURNING id',
    [req.params.id]
  )

  if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' })
  res.json({ message: 'Usuario eliminado correctamente' })
})

app.listen(process.env.PORT, () => {
  console.log(`Users API en puerto ${process.env.PORT}`)
})