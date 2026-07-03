import 'dotenv/config';
import mysql from 'mysql2/promise';

export const createPool = () => {
  const connection = (process.env.DB_CONNECTION || 'mysql').toLowerCase();
  if (connection !== 'mysql') {
    throw new Error('Invalid DB_CONNECTION. This project supports only MySQL.');
  }

  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'database',
    port: Number(process.env.DB_PORT) || 3306,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
  });
};
