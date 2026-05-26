const mysql = require('mysql2/promise');
const fs = require('fs');

async function runMigrations() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'charity_platform'
        });

        console.log('✅ Connected to database\n');

        // Read and execute the migration
        const migrationSQL = fs.readFileSync('./migrations/010_blood_cases.sql', 'utf8');
        const statements = migrationSQL.split(';').filter(s => s.trim());

        for (const statement of statements) {
            try {
                await connection.execute(statement);
                console.log('✅ Executed migration statement');
            } catch (err) {
                if (err.message.includes('already exists')) {
                    console.log('⚠️  Table already exists - skipping');
                } else {
                    console.log('⚠️  ' + err.message.substring(0, 100));
                }
            }
        }

        await connection.end();
        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigrations();
