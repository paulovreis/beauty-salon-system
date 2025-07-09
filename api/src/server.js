import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool from './db/postgre.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import userRoutes from './routes/userRoutes.js';
import employeesRoutes from './routes/employeesRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import productRoutes from './routes/productRoutes.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rotas
app.use('/auth', (req, res, next) => {
  req.pool = pool; // Disponibiliza o pool para os controllers via req.pool
  next();
}, authRoutes);


app.use('/dashboard', (req, res, next) => {
  req.pool = pool;
  next();
}, dashboardRoutes);


// Rotas de gerenciamento de usuários (apenas owner)
app.use('/users', userRoutes);

// Rotas de gerenciamento de funcionários
app.use('/employees', employeesRoutes);

app.use('/services', (req, res, next) => {
  req.pool = pool; // Disponibiliza o pool para os controllers via req.pool
  next();
}, serviceRoutes);

app.use('/products', (req, res, next) => {
  req.pool = pool; // Disponibiliza o pool para os controllers via req.pool
  next();
}, productRoutes); // Aqui você pode adicionar as rotas de produtos se necessário

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Testa conexão com o banco
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected successfully:', result.rows[0]);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
};

startServer().catch(err => console.error('Failed to start server:', err));