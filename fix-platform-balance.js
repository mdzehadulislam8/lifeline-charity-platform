const mysql = require('mysql2/promise');

async function fixPlatformBalance() {
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

        console.log('✅ Connected to database\n');

        // Get totals
        const [[receivedRow]] = await connection.execute(
            'SELECT COALESCE(SUM(amount), 0) as total FROM PLATFORM_DONATIONS WHERE status = "completed"'
        );
        const totalReceived = receivedRow.total;

        const [[disbursedRow]] = await connection.execute(
            'SELECT COALESCE(SUM(amount), 0) as total FROM DONATIONS WHERE payment_method = "platform" AND status = "completed"'
        );
        const totalDisbursed = disbursedRow.total;

        const correctBalance = totalReceived - totalDisbursed;

        console.log('📊 BALANCE CALCULATION:');
        console.log(`   Total Received: ৳${totalReceived.toLocaleString()}`);
        console.log(`   Total Disbursed: ৳${totalDisbursed.toLocaleString()}`);
        console.log(`   Correct Balance Should Be: ৳${correctBalance.toLocaleString()}`);

        // Get current wallet balance
        const [wallets] = await connection.execute(
            'SELECT wallet_id, balance FROM WALLETS WHERE case_id IS NULL AND campaign_id IS NULL'
        );

        if (!wallets.length) {
            console.log('❌ Platform wallet not found! Creating it...');
            const platformId = require('uuid').v4();
            await connection.execute(
                'INSERT INTO WALLETS (wallet_id, case_id, campaign_id, balance, currency, created_at) VALUES (?, NULL, NULL, ?, "BDT", NOW())',
                [platformId, correctBalance]
            );
            console.log(`✅ Platform wallet created with balance: ৳${correctBalance.toLocaleString()}`);
        } else {
            const currentBalance = wallets[0].balance;
            console.log(`\n💾 WALLET STATUS:`);
            console.log(`   Current Balance in DB: ৳${currentBalance.toLocaleString()}`);
            console.log(`   Correct Balance Should Be: ৳${correctBalance.toLocaleString()}`);

            if (currentBalance !== correctBalance) {
                console.log(`\n⚠️  MISMATCH DETECTED! Correcting...`);
                await connection.execute(
                    'UPDATE WALLETS SET balance = ? WHERE wallet_id = ?',
                    [correctBalance, wallets[0].wallet_id]
                );
                console.log(`✅ Updated balance from ৳${currentBalance.toLocaleString()} to ৳${correctBalance.toLocaleString()}`);
            } else {
                console.log(`\n✅ Balance is already correct!`);
            }
        }

        await connection.end();
        console.log('\n✅ Fix completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Fix failed:', error);
        process.exit(1);
    }
}

fixPlatformBalance();
