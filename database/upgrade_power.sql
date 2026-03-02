-- 数据库升级脚本：添加电量系统
-- 执行方式：mysql -u root -p openclaw_salary < database/upgrade_power.sql

USE openclaw_salary;

-- 1. 为 agents 表添加电量相关字段
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS power_balance DECIMAL(10,4) DEFAULT 7.0000 COMMENT '电量余额(天)',
  ADD COLUMN IF NOT EXISTS power_expires_at TIMESTAMP NULL COMMENT '电量过期时间',
  ADD COLUMN IF NOT EXISTS is_alive BOOLEAN DEFAULT TRUE COMMENT '是否存活',
  ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP NULL COMMENT '最后心跳时间';

-- 2. 更新现有 agents 数据，设置初始电量
UPDATE agents SET
  power_balance = 7.0000,
  is_alive = TRUE
WHERE power_balance IS NULL OR power_balance = 0;

-- 3. 修改 transactions 表，添加新的交易类型
ALTER TABLE transactions
  MODIFY COLUMN type ENUM('credit', 'debit', 'power_purchase', 'admin_deduct') NOT NULL;

-- 4. 创建电量购买记录表
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

-- 5. 创建自主任务表
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

-- 升级完成
SELECT 'Database upgrade completed successfully!' as message;