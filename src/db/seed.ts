import { createPool } from './index.ts';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Running database seeder...');
  const pool = createPool();

  try {
    // 1. Insert admin user if not exists
    const adminEmail = 'comercialmetabit@gmail.com';
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if ((existingUsers as any[]).length === 0) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      const uid = 'admin_uid_metabit_2026';
      await pool.query(
        'INSERT INTO users (uid, email, password, name, employee_name) VALUES (?, ?, ?, ?, ?)',
        [uid, adminEmail, hashedPassword, 'Administrador Metabit', 'Administrador']
      );
      console.log('✅ Admin user commercialmetabit@gmail.com seeded successfully.');
    } else {
      console.log('ℹ️ Admin user already exists.');
    }

    // 2. Insert default municipalities if empty
    const [existingMuns] = await pool.query('SELECT id FROM municipalities LIMIT 1');

    if ((existingMuns as any[]).length === 0) {
      const defaultMuns = [
        ['ARCO-ÍRIS', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@arcoiris.sp.gov.br', 'Importado via solicitação'],
        ['ARTUR NOG.', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@arturnog.sp.gov.br', 'Importado via solicitação'],
        ['BASTOS', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@bastos.sp.gov.br', 'Importado via solicitação'],
        ['CATANDUVA', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@catanduva.sp.gov.br', 'Importado via solicitação'],
        ['CÂNDIDO M', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@candidom.sp.gov.br', 'Importado via solicitação'],
        ['CANDIDO R.', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@candidor.sp.gov.br', 'Importado via solicitação'],
        ['CRUZÁLIA', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@cruzalia.sp.gov.br', 'Importado via solicitação'],
        ['HERCULAN.', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@herculan.sp.gov.br', 'Importado via solicitação'],
        ['JABOTIC.', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@jabotic.sp.gov.br', 'Importado via solicitação'],
        ['LUIZIANIA', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@luiziania.sp.gov.br', 'Importado via solicitação'],
        ['PIRASSUN.', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@pirassun.sp.gov.br', 'Importado via solicitação'],
        ['POMPÉIA', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@pompeia.sp.gov.br', 'Importado via solicitação'],
        ['QUEIROZ', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@queiroz.sp.gov.br', 'Importado via solicitação'],
        ['QUINTANA', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@quintana.sp.gov.br', 'Importado via solicitação'],
        ['RINCÃO', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@rincao.sp.gov.br', 'Importado via solicitação'],
        ['SERRANA', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@serrana.sp.gov.br', 'Importado via solicitação'],
        ['TUPÃ', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@tupa.sp.gov.br', 'Importado via solicitação'],
        ['S.J.DUAS PONTES', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@sjduaspontes.sp.gov.br', 'Importado via solicitação'],
        ['TAGUAÍ', 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', 'contato@taguai.sp.gov.br', 'Importado via solicitação']
      ];

      for (const mun of defaultMuns) {
        await pool.query(
          'INSERT INTO municipalities (name, state, responsible, phone, email, observations) VALUES (?, ?, ?, ?, ?, ?)',
          mun
        );
      }
      console.log('✅ Seeded 19 default municipalities successfully.');
    } else {
      console.log('ℹ️ Municipalities already exist.');
    }

    console.log('✅ Database seeding completed successfully.');
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
