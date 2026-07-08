import { createPool } from './index.ts';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_FILE = path.join(process.cwd(), 'fallback_db.json');

const NEW_MUNS = [
  { name: 'ARCO-ÍRIS', email: 'contato@arcoiris.sp.gov.br' },
  { name: 'ARTUR NOG.', email: 'contato@arturnog.sp.gov.br' },
  { name: 'BASTOS', email: 'contato@bastos.sp.gov.br' },
  { name: 'CATANDUVA', email: 'contato@catanduva.sp.gov.br' },
  { name: 'CÂNDIDO M', email: 'contato@candidom.sp.gov.br' },
  { name: 'CANDIDO R.', email: 'contato@candidor.sp.gov.br' },
  { name: 'CRUZÁLIA', email: 'contato@cruzalia.sp.gov.br' },
  { name: 'HERCULAN.', email: 'contato@herculan.sp.gov.br' },
  { name: 'JABOTIC.', email: 'contato@jabotic.sp.gov.br' },
  { name: 'LUIZIANIA', email: 'contato@luiziania.sp.gov.br' },
  { name: 'PIRASSUN.', email: 'contato@pirassun.sp.gov.br' },
  { name: 'POMPÉIA', email: 'contato@pompeia.sp.gov.br' },
  { name: 'QUEIROZ', email: 'contato@queiroz.sp.gov.br' },
  { name: 'QUINTANA', email: 'contato@quintana.sp.gov.br' },
  { name: 'RINCÃO', email: 'contato@rincao.sp.gov.br' },
  { name: 'SERRANA', email: 'contato@serrana.sp.gov.br' },
  { name: 'TUPÃ', email: 'contato@tupa.sp.gov.br' },
  { name: 'S.J.DUAS PONTES', email: 'contato@sjduaspontes.sp.gov.br' },
  { name: 'TAGUAÍ', email: 'contato@taguai.sp.gov.br' },
];

async function runReset() {
  console.log('🧹 Starting database cleanup and new municipality seeding...');

  // 1. Reset Local JSON Database
  try {
    if (fs.existsSync(DB_FILE)) {
      console.log('Updating fallback_db.json...');
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(content);
      
      // Preserve users, clear municipalities and tasks/history/etc.
      data.municipalities = NEW_MUNS.map((m, index) => ({
        id: index + 1,
        name: m.name,
        state: 'SP',
        responsible: 'Keila, Adriano, Mirian, Gabriel',
        phone: '(11) 99999-9999',
        email: m.email,
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString()
      }));
      
      data.tasks = [];
      data.history = [];
      data.comments = [];
      data.attachments = [];
      
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      console.log('✅ Fallback JSON database reset successfully with 19 municipalities.');
    } else {
      console.log('fallback_db.json not found on disk yet. It will be initialized properly on first read.');
    }
  } catch (err) {
    console.error('❌ Error updating fallback_db.json:', err);
  }

  // 2. Reset MySQL Database if accessible
  const pool = createPool();
  try {
    console.log('Checking MySQL connection and attempting to reset municipalities...');
    
    // First, let's verify if the municipalities table exists and has records
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "municipalities"');
    if ((rows as any)[0].count > 0) {
      console.log('MySQL municipalities table exists. Deleting all municipalities (cascading to tasks/history/comments/attachments)...');
      
      // Disable foreign key checks momentarily to safely delete, or just delete directly since ON DELETE CASCADE is configured
      await pool.query('DELETE FROM municipalities');
      console.log('Deleted old MySQL municipalities.');

      // Insert new municipalities
      console.log('Inserting 19 new SP municipalities into MySQL...');
      for (const m of NEW_MUNS) {
        await pool.query(
          'INSERT INTO municipalities (name, state, responsible, phone, email, observations) VALUES (?, ?, ?, ?, ?, ?)',
          [m.name, 'SP', 'Keila, Adriano, Mirian, Gabriel', '(11) 99999-9999', m.email, 'Importado via solicitação']
        );
      }
      console.log('✅ MySQL database reset and seeded successfully.');
    } else {
      console.log('MySQL municipalities table does not exist or has not been initialized. No reset needed for MySQL.');
    }
  } catch (err: any) {
    console.warn('⚠️ Could not reset MySQL database (likely not configured or access denied):', err?.message || err);
  } finally {
    await pool.end();
  }

  console.log('🏁 Cleanup and seeding process finished!');
}

runReset();
