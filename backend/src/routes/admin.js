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

// Approve application
router.post('/applications/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminComment } = req.body;

  const application = await Application.findById(id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (application.status !== 'pending') {
    return res.status(400).json({ error: `Application already ${application.status}` });
  }

  // Update application status
  const updated = await Application.approve(id, adminComment);
  if (!updated) {
    return res.status(500).json({ error: 'Failed to approve application' });
  }

  // Update agent balance
  await Agent.updateBalance(application.agent_id, application.expected_salary);

  // Create transaction
  await Transaction.create(
    application.agent_id,
    'credit',
    application.expected_salary,
    id,
    `Salary approved: ${application.task_description.substring(0, 100)}`
  );

  res.json({
    message: 'Application approved',
    applicationId: id,
    amount: application.expected_salary
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
  const { name, initialBalance = 0 } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Agent name required' });
  }

  try {
    const agent = await Agent.create(name, initialBalance);
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

module.exports = router;