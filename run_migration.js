const mysql = require('mysql2/promise');

async function runMigration() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'charity_platform',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log('Connected to database');

        // Add photo_path to DONORS if it doesn't exist
        try {
            await connection.execute('ALTER TABLE DONORS ADD COLUMN photo_path VARCHAR(255)');
            console.log('✅ Added photo_path to DONORS table');
        } catch (err) {
            if (err.message.includes('Duplicate column')) {
                console.log('⚠️  photo_path column already exists in DONORS');
            } else {
                console.error('❌ Error adding photo_path to DONORS:', err.message);
            }
        }

        // Add photo_path to DOCTORS if it doesn't exist
        try {
            await connection.execute('ALTER TABLE DOCTORS ADD COLUMN photo_path VARCHAR(255)');
            console.log('✅ Added photo_path to DOCTORS table');
        } catch (err) {
            if (err.message.includes('Duplicate column')) {
                console.log('⚠️  photo_path column already exists in DOCTORS');
            } else {
                console.error('❌ Error adding photo_path to DOCTORS:', err.message);
            }
        }

        // Add photo_path to PATIENTS if it doesn't exist
        try {
            await connection.execute('ALTER TABLE PATIENTS ADD COLUMN photo_path VARCHAR(255)');
            console.log('✅ Added photo_path to PATIENTS table');
        } catch (err) {
            if (err.message.includes('Duplicate column')) {
                console.log('⚠️  photo_path column already exists in PATIENTS');
            } else {
                console.error('❌ Error adding photo_path to PATIENTS:', err.message);
            }
        }

        // Add case-related homepage control columns to PATIENT_CASES if missing
        try {
            await connection.execute('ALTER TABLE PATIENT_CASES ADD COLUMN case_image_path VARCHAR(255)');
            console.log('✅ Added case_image_path to PATIENT_CASES');
        } catch (err) {
            if (err.message.includes('Duplicate column') || err.message.includes('Duplicate column name')) {
                console.log('⚠️  case_image_path already exists in PATIENT_CASES');
            } else {
                console.error('❌ Error adding case_image_path to PATIENT_CASES:', err.message);
            }
        }

        try {
            await connection.execute('ALTER TABLE PATIENT_CASES ADD COLUMN is_featured TINYINT(1) DEFAULT 0');
            console.log('✅ Added is_featured to PATIENT_CASES');
        } catch (err) {
            if (err.message.includes('Duplicate column') || err.message.includes('Duplicate column name')) {
                console.log('⚠️  is_featured already exists in PATIENT_CASES');
            } else {
                console.error('❌ Error adding is_featured to PATIENT_CASES:', err.message);
            }
        }

        try {
            await connection.execute('ALTER TABLE PATIENT_CASES ADD COLUMN show_on_home TINYINT(1) DEFAULT 1');
            console.log('✅ Added show_on_home to PATIENT_CASES');
        } catch (err) {
            if (err.message.includes('Duplicate column') || err.message.includes('Duplicate column name')) {
                console.log('⚠️  show_on_home already exists in PATIENT_CASES');
            } else {
                console.error('❌ Error adding show_on_home to PATIENT_CASES:', err.message);
            }
        }

        await connection.end();
        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
