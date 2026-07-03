import { createPool } from './index.ts';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Starting MySQL migration and seeding...');
  const pool = createPool();

  try {
    // 1. Create tables
    console.log('Creating tables if they do not exist...');

    // Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NULL,
        employee_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Municipalities
    await pool.query(`
      CREATE TABLE IF NOT EXISTS municipalities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        state VARCHAR(50) NOT NULL,
        responsible VARCHAR(255) NOT NULL,
        phone VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        observations TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Tasks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        municipality_id INT NOT NULL,
        obligation_code VARCHAR(50) NOT NULL,
        competence VARCHAR(100) NOT NULL,
        year INT NOT NULL,
        status VARCHAR(100) DEFAULT 'Falta XML' NOT NULL,
        siops_membros VARCHAR(100) NULL,
        siope_folha VARCHAR(100) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // History
    await pool.query(`
      CREATE TABLE IF NOT EXISTS history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        field_changed VARCHAR(100) NOT NULL,
        old_value TEXT NULL,
        new_value TEXT NULL,
        user_who_changed VARCHAR(255) NULL,
        observation TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Comments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Attachments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        comment_id INT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INT NOT NULL,
        file_data LONGTEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('Tables verified/created successfully.');

    // 2. Insert admin user if not exists
    console.log('Seeding initial administrator user...');
    const adminEmail = 'comercialmetabit@gmail.com';
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if ((existingUsers as any[]).length === 0) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      const uid = 'admin_uid_metabit_2026';
      await pool.query(
        'INSERT INTO users (uid, email, password, name, employee_name) VALUES (?, ?, ?, ?, ?)',
        [uid, adminEmail, hashedPassword, 'Administrador Metabit', 'Administrador']
      );
      console.log('Admin user commercialmetabit@gmail.com created successfully with password: admin');
    } else {
      console.log('Admin user already exists.');
    }

    // 3. Insert some default municipalities if empty
    console.log('Checking for existing municipalities...');
    const [existingMuns] = await pool.query('SELECT id FROM municipalities LIMIT 1');

    if ((existingMuns as any[]).length === 0) {
      console.log('Seeding default municipalities...');
      const defaultMuns = [
        ['Goiânia', 'GO', 'Keila', '(62) 99999-9999', 'goiania@municipio.go.gov.br', 'Município Polo da Região'],
        ['Aparecida de Goiânia', 'GO', 'Simão', '(62) 88888-8888', 'aparecida@municipio.go.gov.br', 'Atendimento prioritário'],
        ['Anápolis', 'GO', 'Mirian', '(62) 77777-7777', 'anapolis@municipio.go.gov.br', 'Polo Industrial e Logístico'],
        ['Rio Verde', 'GO', 'Richelly', '(64) 96666-6666', 'rioverde@municipio.go.gov.br', 'Destaque no Agronegócio'],
        ['Luziânia', 'GO', 'Gabriel', '(61) 95555-5555', 'luziania@municipio.go.gov.br', 'Região do Entorno do DF']
      ];

      for (const mun of defaultMuns) {
        await pool.query(
          'INSERT INTO municipalities (name, state, responsible, phone, email, observations) VALUES (?, ?, ?, ?, ?, ?)',
          mun
        );
      }
      console.log('Seeded 5 default municipalities successfully.');
    } else {
      console.log('Municipalities table is already populated.');
    }

    console.log('Database migration and seeding completed successfully!');
  } catch (err) {
    console.error('Error during migration and seeding:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

// Check if executed directly
if (process.argv[1] === import.meta.filename || process.argv[1]?.endsWith('seed.ts')) {
  seed();
}

export { seed };
