const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'charity_platform'
  });

  try {
    console.log('Connected to DB');
    const tables = ['PATIENTS','DOCTORS','DONORS'];
    for (const t of tables) {
      const [rows] = await conn.execute(`SELECT COUNT(*) as cnt FROM ${t} WHERE photo_path LIKE '%default-patient.jpg%'`);
      const count = rows[0].cnt;
      if (count > 0) {
        console.log(`Updating ${count} rows in ${t}...`);
        await conn.execute(`UPDATE ${t} SET photo_path = NULL WHERE photo_path LIKE '%default-patient.jpg%'`);
        console.log(`✅ Cleared ${t}`);
      } else {
        console.log(`No default photo rows in ${t}`);
      }
    }

    console.log('Done');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
