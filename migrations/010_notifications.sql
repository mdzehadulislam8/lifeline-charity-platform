-- ===================================
-- NOTIFICATIONS TABLE
-- ===================================

CREATE TABLE IF NOT EXISTS NOTIFICATIONS (
    notification_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id VARCHAR(255),
    related_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (notification_type),
    INDEX idx_read (is_read),
    INDEX idx_created (created_at)
);

-- notification_type values:
-- 'case_submitted' - patient submitted a case
-- 'case_approved' - case was approved by lifeline team
-- 'case_rejected' - case was rejected by lifeline team
-- 'case_updated' - case was updated
-- 'donation_received' - donation received for a case
