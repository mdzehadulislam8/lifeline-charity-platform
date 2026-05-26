const mysql = require('mysql2/promise');

async function runPlatformMigration() {
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

        console.log('✅ Connected to database');

        // Create PLATFORM_DONATIONS table
        try {
            await connection.execute(`CREATE TABLE IF NOT EXISTS PLATFORM_DONATIONS (
              platform_donation_id CHAR(36) PRIMARY KEY,
              donor_id CHAR(36),
              amount DECIMAL(14,2) NOT NULL,
              payment_method VARCHAR(50),
              provider_reference VARCHAR(255),
              donation_date DATETIME NOT NULL,
              status VARCHAR(50) DEFAULT 'completed',
              is_anonymous TINYINT(1) DEFAULT 0,
              guest_name VARCHAR(255),
              guest_email VARCHAR(255),
              message TEXT
            )`);
            console.log('✅ PLATFORM_DONATIONS table created/verified');
        } catch (err) {
            console.error('❌ Error with PLATFORM_DONATIONS:', err.message);
        }

        // Create PLATFORM_ALLOCATIONS table
        try {
            await connection.execute(`CREATE TABLE IF NOT EXISTS PLATFORM_ALLOCATIONS (
              allocation_id CHAR(36) PRIMARY KEY,
              case_id VARCHAR(255) NOT NULL,
              amount DECIMAL(14,2) NOT NULL,
              allocated_by VARCHAR(255),
              allocated_at DATETIME NOT NULL,
              comment TEXT,
              FOREIGN KEY (case_id) REFERENCES PATIENT_CASES(case_id) ON DELETE CASCADE
            )`);
            console.log('✅ PLATFORM_ALLOCATIONS table created/verified');
        } catch (err) {
            console.error('❌ Error with PLATFORM_ALLOCATIONS:', err.message);
        }

        // Create indexes
        try {
            await connection.execute(`CREATE INDEX IF NOT EXISTS idx_platform_donations_status ON PLATFORM_DONATIONS(status)`);
            console.log('✅ Index on PLATFORM_DONATIONS(status) created/verified');
        } catch (err) {
            if (!err.message.includes('Duplicate key name')) {
                console.error('⚠️  Index creation note:', err.message);
            }
        }

        try {
            await connection.execute(`CREATE INDEX IF NOT EXISTS idx_platform_allocations_case ON PLATFORM_ALLOCATIONS(case_id)`);
            console.log('✅ Index on PLATFORM_ALLOCATIONS(case_id) created/verified');
        } catch (err) {
            if (!err.message.includes('Duplicate key name')) {
                console.error('⚠️  Index creation note:', err.message);
            }
        }

        // Verify WALLETS table has platform fund wallet
        try {
            const [wallets] = await connection.execute(
                'SELECT COUNT(*) as cnt FROM WALLETS WHERE case_id IS NULL AND campaign_id IS NULL'
            );
            if (wallets[0].cnt === 0) {
                const platformId = require('uuid').v4();
                await connection.execute(
                    'INSERT INTO WALLETS (wallet_id, case_id, campaign_id, balance, currency, created_at) VALUES (?, NULL, NULL, 0, "BDT", NOW())',
                    [platformId]
                );
                console.log('✅ Created platform wallet in WALLETS table');
            } else {
                console.log('✅ Platform wallet already exists in WALLETS');
            }
        } catch (err) {
            console.error('❌ Error with WALLETS platform entry:', err.message);
        }

        await connection.end();
        console.log('\n✅ Platform migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Platform migration failed:', error);
        process.exit(1);
    }
}

runPlatformMigration();
