const mysql = require('mysql2/promise');

async function testPlatformFund() {
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

        // Check PLATFORM_DONATIONS table
        console.log('=== PLATFORM_DONATIONS TABLE ===');
        const [donations] = await connection.execute('SELECT * FROM PLATFORM_DONATIONS ORDER BY donation_date DESC LIMIT 5');
        console.log(`Total donations: ${donations.length}`);
        donations.forEach(d => {
            console.log(`  - ID: ${d.platform_donation_id}, Amount: ${d.amount}, Donor: ${d.guest_name}, Date: ${d.donation_date}, Status: ${d.status}`);
        });

        // Check WALLETS (platform fund)
        console.log('\n=== WALLETS TABLE (Platform Fund) ===');
        const [wallets] = await connection.execute('SELECT * FROM WALLETS WHERE case_id IS NULL AND campaign_id IS NULL');
        console.log(`Platform wallets: ${wallets.length}`);
        wallets.forEach(w => {
            console.log(`  - ID: ${w.wallet_id}, Balance: ${w.balance}, Currency: ${w.currency}`);
        });

        // Check sum of platform donations
        console.log('\n=== PLATFORM DONATION SUM ===');
        const [[sumRow]] = await connection.execute('SELECT COALESCE(SUM(amount), 0) as total FROM PLATFORM_DONATIONS WHERE status = "completed"');
        console.log(`Total received: ${sumRow.total}`);

        // Check donations sent to patients from platform
        console.log('\n=== DONATIONS SENT TO PATIENTS FROM PLATFORM ===');
        const [platformDonations] = await connection.execute('SELECT * FROM DONATIONS WHERE payment_method = "platform" ORDER BY donation_date DESC LIMIT 5');
        console.log(`Total platform donations to patients: ${platformDonations.length}`);
        platformDonations.forEach(d => {
            console.log(`  - ID: ${d.donation_id}, Case: ${d.case_id}, Amount: ${d.amount}, Date: ${d.donation_date}`);
        });

        const [[disbursedRow]] = await connection.execute('SELECT COALESCE(SUM(amount), 0) as total FROM DONATIONS WHERE payment_method = "platform" AND status = "completed"');
        console.log(`Total disbursed to patients: ${disbursedRow.total}`);

        await connection.end();
        console.log('\n✅ Test completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testPlatformFund();
