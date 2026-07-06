import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.ts';

export const createPool = () => {
  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'database',
    port: Number(process.env.DB_PORT) || 3306,
    connectionLimit: 10,
  });
};

const pool = createPool();

export const db = drizzle(pool, { schema, mode: 'default' });
