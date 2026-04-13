require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')

const app = express()
app.use(express.json())

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

// GET usuarios
app.get('/users', async (req, res) => {
  const result = await pool.query('SELECT * FROM users')
  res.json(result.rows)
})

// GET usuario por ID
app.get('/users/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [req.params.id]
  )
  res.json(result.rows[0])
})

app.listen(process.env.PORT, () => {
  console.log(`Users API en puerto ${process.env.PORT}`)
})