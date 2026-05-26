const pool = require('../config/database');

// GET /api/stats
async function getStats(req, res, next) {
    let conn;
    try {
        conn = await pool.getConnection();

        const [rowsLives] = await conn.query(`
            SELECT COUNT(*) AS livesSaved
            FROM PATIENT_CASES
            WHERE patient_satisfied = TRUE
        `);

        const [rowsAmount] = await conn.query(`
            SELECT COALESCE(SUM(amount),0) AS amountRaised
            FROM DONATIONS
            WHERE status IN ('completed','success','paid')
        `);

        const [rowsActiveCases] = await conn.query(`
            SELECT COUNT(*) AS activeCases
            FROM PATIENT_CASES
            WHERE status = 'approved'
        `);

        const [rowsActiveDonors] = await conn.query(`
            SELECT COUNT(DISTINCT d.donor_id) AS activeDonors
            FROM DONORS d
            LEFT JOIN DONATIONS t ON d.donor_id = t.donor_id
            WHERE COALESCE(d.total_donated_amount,0) > 0 OR (t.status IN ('completed','success','paid'))
        `);

        const stats = {
            livesSaved: Number(rowsLives[0]?.livesSaved || 0),
            amountRaised: Number(rowsAmount[0]?.amountRaised || 0),
            activeCases: Number(rowsActiveCases[0]?.activeCases || 0),
            activeDonors: Number(rowsActiveDonors[0]?.activeDonors || 0)
        };

        res.json({ success: true, data: stats });
    } catch (err) {
        next(err);
    } finally {
        if (conn) conn.release();
    }
}

// POST /api/stats/case-satisfaction
async function markCaseSatisfied(req, res, next) {
    let conn;
    try {
        const { caseId } = req.params;
        const { review } = req.body;
        const userId = req.user?.userId || req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        conn = await pool.getConnection();

        // Verify patient owns this case
        const [caseRows] = await conn.query(`
            SELECT pc.case_id, p.user_id FROM PATIENT_CASES pc
            JOIN PATIENTS p ON pc.patient_id = p.patient_id
            WHERE pc.case_id = ?
        `, [caseId]);

        if (!caseRows.length) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        if (caseRows[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        // Mark case as satisfied
        await conn.query(`
            UPDATE PATIENT_CASES
            SET patient_satisfied = TRUE,
                patient_review = ?,
                patient_review_date = NOW()
            WHERE case_id = ?
        `, [review || '', caseId]);

        res.json({ success: true, message: 'Case marked as resolved. Thank you for your feedback!' });
    } catch (err) {
        next(err);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { getStats, markCaseSatisfied };
