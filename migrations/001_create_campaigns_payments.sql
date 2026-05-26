-- Migration: create CAMPAIGNS, PAYMENTS, ORGANIZERS tables
-- Run this against your MySQL database

CREATE TABLE IF NOT EXISTS ORGANIZERS (
  organizer_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS CAMPAIGNS (
  campaign_id VARCHAR(255) PRIMARY KEY,
  organizer_id VARCHAR(255),
  patient_name VARCHAR(255),
  title VARCHAR(255),
  category VARCHAR(100),
  goal_amount DECIMAL(20,2) DEFAULT 0,
  collected_amount DECIMAL(20,2) DEFAULT 0,
  hospital_name VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, verified, published, rejected
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES ORGANIZERS(organizer_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS PAYMENTS (
  payment_id VARCHAR(255) PRIMARY KEY,
  campaign_id VARCHAR(255),
  donor_name VARCHAR(255),
  donor_email VARCHAR(255),
  amount DECIMAL(20,2) DEFAULT 0,
  provider VARCHAR(50),
  provider_reference VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES CAMPAIGNS(campaign_id) ON DELETE CASCADE
);
