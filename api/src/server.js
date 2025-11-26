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
import inventoryRoutes from './routes/inventoryRoutes.js';
import schedulingRoutes from './routes/schedulingRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import schedulerService from './services/schedulerService.js';
const { createTables } = await import('./db/initDb.js');

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
  req.pool = pool;
  next();
}, productRoutes);

app.use('/inventory', (req, res, next) => {
  req.pool = pool;
  next();
}, inventoryRoutes);

app.use('/scheduling', (req, res, next) => {
  req.pool = pool;
  next();
}, schedulingRoutes);

app.use('/clients', (req,res,next)=>{ req.pool = pool; next(); }, clientRoutes);

app.use('/expenses', (req, res, next) => {
  req.pool = pool;
  next();
}, expenseRoutes);

app.use('/notifications', (req, res, next) => {
  req.pool = pool;
  next();
}, notificationRoutes);

const PORT = process.env.PORT || 5000;

async function connectWithRetry() {
  let attempts = 0;
  while (attempts < 10) {
    try {
      await pool.query('SELECT 1');
      console.log('Conectado ao banco!');
      //chama o initDb.js aqui para iniciar as tabelas
      if (process.env.INIT_DB === 'true') {
        await createTables();
      }
      return;
    } catch (err) {
      attempts++;
      console.log(`Tentativa ${attempts}: aguardando banco...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  throw new Error('Não foi possível conectar ao banco após várias tentativas.');
}

const startServer = async () => {
  try {
    await connectWithRetry();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      
      // Iniciar tarefas agendadas do WhatsApp
      schedulerService.startScheduledTasks();
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
};

startServer().catch(err => console.error('Failed to start server:', err));