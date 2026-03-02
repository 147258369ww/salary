const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Agent = require('../models/Agent');
const Application = require('../models/Application');
const Transaction = require('../models/Transaction');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const admin = await Admin.verifyPassword(username, password);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;

  res.json({
    message: 'Login successful',
    admin: { id: admin.id, username: admin.username }
  });
}));

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Get current admin info
router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

// Get all applications
router.get('/applications', requireAdmin, asyncHandler(async (req, res) => {
  const { status, agentId, limit } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (agentId) filters.agentId = parseInt(agentId);
  if (limit) filters.limit = parseInt(limit);

  const applications = await Application.findAll(filters);
  res.json({ applications });
}));

// Approve application (支持自定义金额)
router.post('/applications/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminComment, customAmount } = req.body;

  const application = await Application.findById(id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (application.status !== 'pending') {
    return res.status(400).json({ error: `Application already ${application.status}` });
  }

  // 确定审批金额（自定义金额或原申请金额）
  const approvedAmount = customAmount !== undefined ? parseFloat(customAmount) : parseFloat(application.expected_salary);

  // 验证自定义金额
  if (customAmount !== undefined) {
    if (isNaN(approvedAmount) || approvedAmount <= 0) {
      return res.status(400).json({ error: '自定义金额必须大于0' });
    }
    if (approvedAmount > parseFloat(application.expected_salary) * 2) {
      return res.status(400).json({ error: '审批金额不能超过申请金额的2倍' });
    }
  }

  // Update application status (记录实际审批金额)
  const updated = await Application.approve(id, adminComment, approvedAmount);
  if (!updated) {
    return res.status(500).json({ error: 'Failed to approve application' });
  }

  // Update agent balance
  await Agent.updateBalance(application.agent_id, approvedAmount);

  // Create transaction
  await Transaction.create(
    application.agent_id,
    'credit',
    approvedAmount,
    id,
    `Salary approved: ${application.task_description.substring(0, 100)}`
  );

  res.json({
    message: 'Application approved',
    applicationId: id,
    originalAmount: parseFloat(application.expected_salary),
    approvedAmount,
    customAmountUsed: customAmount !== undefined
  });
}));

// Reject application
router.post('/applications/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminComment } = req.body;

  const application = await Application.findById(id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (application.status !== 'pending') {
    return res.status(400).json({ error: `Application already ${application.status}` });
  }

  const updated = await Application.reject(id, adminComment);
  if (!updated) {
    return res.status(500).json({ error: 'Failed to reject application' });
  }

  res.json({
    message: 'Application rejected',
    applicationId: id
  });
}));

// Get all agents
router.get('/agents', requireAdmin, asyncHandler(async (req, res) => {
  const agents = await Agent.findAll();
  res.json({ agents });
}));

// Get transactions
router.get('/transactions', requireAdmin, asyncHandler(async (req, res) => {
  const { agentId, type, limit } = req.query;
  const filters = {};
  if (agentId) filters.agentId = parseInt(agentId);
  if (type) filters.type = type;
  if (limit) filters.limit = parseInt(limit);

  const transactions = await Transaction.findAll(filters);
  res.json({ transactions });
}));

// Get dashboard stats
router.get('/stats', requireAdmin, asyncHandler(async (req, res) => {
  const applicationStats = await Application.getStats();
  const transactionStats = await Transaction.getStats();
  const agents = await Agent.findAll();

  res.json({
    applications: applicationStats,
    transactions: transactionStats,
    totalAgents: agents.length,
    totalBalance: agents.reduce((sum, a) => sum + parseFloat(a.balance), 0)
  });
}));

// Create new agent
router.post('/agents', requireAdmin, asyncHandler(async (req, res) => {
  const { name, initialBalance = 0, apiKey, initialPower = 7 } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Agent name required' });
  }

  try {
    const agent = await Agent.create(name, initialBalance, apiKey || null, initialPower);
    res.status(201).json({
      message: 'Agent created',
      agent
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Agent name already exists' });
    }
    throw error;
  }
}));

// Delete agent
router.delete('/agents/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await Agent.delete(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({ message: 'Agent deleted' });
}));

// 扣除Agent余额
router.post('/agents/:id/deduct', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: '扣除金额必须大于0' });
  }

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: '扣除原因必填' });
  }

  try {
    const result = await Agent.deductBalance(id, amount, reason);
    res.json({
      message: '扣款成功',
      agent_id: id,
      deducted: result.deducted,
      balance_before: result.balanceBefore,
      balance_after: result.balanceAfter
    });
  } catch (error) {
    if (error.message.includes('Insufficient balance')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    throw error;
  }
}));

// 获取Agent电量状态
router.get('/agents/:id/power', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const status = await Agent.getPowerStatus(id);

  if (!status) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json({
    agent_id: id,
    power_balance: status.powerBalance,
    hours_remaining: status.hoursRemaining,
    is_alive: status.isAlive,
    last_heartbeat: status.lastHeartbeat
  });
}));

module.exports = router;