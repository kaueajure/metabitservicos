import { createPool } from './index.ts';

async function migrate() {
  console.log('Running database migrations (creating tables)...');
  const pool = createPool();

  try {
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
        responsible TEXT NOT NULL,
        phone VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        observations TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure existing municipalities table has responsible as TEXT
    await pool.query(`
      ALTER TABLE municipalities MODIFY COLUMN responsible TEXT NOT NULL;
    `).catch(() => {});

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

    console.log('✅ All database tables created / migrated successfully.');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
