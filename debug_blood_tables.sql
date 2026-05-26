-- Check BLOOD_DONATIONS table structure and data
SELECT 'BLOOD_DONATIONS Structure' AS info;
DESCRIBE BLOOD_DONATIONS;

SELECT '---' AS separator;
SELECT 'BLOOD_DONATIONS Data' AS info;
SELECT * FROM BLOOD_DONATIONS ORDER BY donation_date DESC LIMIT 10;

SELECT '---' AS separator;
SELECT 'DONORS Data' AS info;
SELECT d.donor_id, d.user_id, u.username FROM DONORS d LEFT JOIN USERS u ON d.user_id = u.user_id;

SELECT '---' AS separator;
SELECT 'BLOOD_DONORS Data' AS info;
SELECT bd.blood_donor_id, bd.donor_id, bd.blood_type, bd.rh_factor, bd.location, d.user_id FROM BLOOD_DONORS bd LEFT JOIN DONORS d ON bd.donor_id = d.donor_id;
