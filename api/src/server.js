import pool from "./db/postgre.js";

const startServer = async () => {
  try {
    // Test database connection
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected successfully:', result.rows[0]);

    // Start your server logic here (e.g., Express app)
    console.log('Server is running...');

  } catch (error) {
    console.error('Error starting server:', error);
  }
}

startServer().catch(err => console.error('Failed to start server:', err));