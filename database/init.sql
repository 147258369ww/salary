-- OpenClaw Salary Management System Database
-- Run this script to initialize the database

CREATE DATABASE IF NOT EXISTS openclaw_salary DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE openclaw_salary;

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents table (AI Agents)
CREATE TABLE IF NOT EXISTS agents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Salary applications table
CREATE TABLE IF NOT EXISTS salary_applications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id INT NOT NULL,
  task_description TEXT NOT NULL,
  expected_salary DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  admin_comment TEXT,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id INT NOT NULL,
  type ENUM('credit', 'debit') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  application_id INT,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES salary_applications(id) ON DELETE SET NULL
);

-- Insert default admin (password: admin123)
INSERT INTO admins (username, password_hash) VALUES
('admin', '$2a$10$JmtHNJjD1H2qp3Sd4EcZOO4UF2mxUu2.9K1AHGgI0bDi/0s6vIBxG');

-- Insert default OpenClaw agent
INSERT INTO agents (name, api_key, balance) VALUES
('openclaw', 'openclaw_api_key_2024_secure', 0.00);