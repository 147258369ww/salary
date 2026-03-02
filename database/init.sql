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
  power_balance DECIMAL(10,4) DEFAULT 0.0000 COMMENT '电量余额(天)',
  power_expires_at TIMESTAMP NULL COMMENT '电量过期时间',
  is_alive BOOLEAN DEFAULT TRUE COMMENT '是否存活',
  last_heartbeat TIMESTAMP NULL COMMENT '最后心跳时间',
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
  type ENUM('credit', 'debit', 'power_purchase', 'admin_deduct') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  application_id INT,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES salary_applications(id) ON DELETE SET NULL
);

-- Power purchases table (电量购买记录)
CREATE TABLE IF NOT EXISTS power_purchases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id INT NOT NULL,
  days DECIMAL(10,4) NOT NULL COMMENT '购买天数',
  amount DECIMAL(10,2) NOT NULL COMMENT '支付金额',
  balance_before DECIMAL(10,2) NOT NULL COMMENT '购买前余额',
  balance_after DECIMAL(10,2) NOT NULL COMMENT '购买后余额',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Auto tasks table (自主任务记录)
CREATE TABLE IF NOT EXISTS auto_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id INT NOT NULL,
  task_type VARCHAR(50) NOT NULL COMMENT '任务类型',
  task_description TEXT NOT NULL COMMENT '任务描述',
  expected_salary DECIMAL(10,2) NOT NULL COMMENT '期望工资',
  application_id INT NULL COMMENT '关联的工资申请ID',
  status ENUM('pending', 'submitted', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES salary_applications(id) ON DELETE SET NULL
);

-- Insert default admin (password: admin123)
INSERT INTO admins (username, password_hash) VALUES
('admin', '$2a$10$JmtHNJjD1H2qp3Sd4EcZOO4UF2mxUu2.9K1AHGgI0bDi/0s6vIBxG');

-- Insert default OpenClaw agent (初始电量7天)
INSERT INTO agents (name, api_key, balance, power_balance, is_alive) VALUES
('openclaw', 'openclaw_api_key_2024_secure', 0.00, 7.0000, TRUE);