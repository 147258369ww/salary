const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const Application = require('../models/Application');
const Transaction = require('../models/Transaction');
const { requireAgent } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Get current agent info
router.get('/me', requireAgent, (req, res) => {
  res.json({
    agent: {
      id: req.agent.id,
      name: req.agent.name,
      balance: parseFloat(req.agent.balance),
      created_at: req.agent.created_at
    }
  });
});

// Submit salary application
router.post('/apply', requireAgent, asyncHandler(async (req, res) => {
  const { task_description, expected_salary, reason } = req.body;

  // Validation
  if (!task_description || task_description.trim().length === 0) {
    return res.status(400).json({ error: 'Task description is required' });
  }

  if (!expected_salary || expected_salary <= 0) {
    return res.status(400).json({ error: 'Expected salary must be greater than 0' });
  }

  if (expected_salary > 10000) {
    return res.status(400).json({ error: 'Expected salary exceeds maximum limit (10000)' });
  }

  const applicationId = await Application.create(
    req.agent.id,
    task_description,
    expected_salary,
    reason || null
  );

  res.status(201).json({
    message: 'Application submitted successfully',
    application: {
      id: applicationId,
      task_description,
      expected_salary,
      reason,
      status: 'pending'
    }
  });
}));

// Get my applications
router.get('/applications', requireAgent, asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const applications = await Application.findByAgentId(
    req.agent.id,
    limit ? parseInt(limit) : 20
  );

  res.json({
    applications: applications.map(app => ({
      id: app.id,
      task_description: app.task_description,
      expected_salary: parseFloat(app.expected_salary),
      reason: app.reason,
      status: app.status,
      admin_comment: app.admin_comment,
      created_at: app.created_at,
      reviewed_at: app.reviewed_at
    }))
  });
}));

// Get balance
router.get('/balance', requireAgent, async (req, res) => {
  const balance = await Agent.getBalance(req.agent.id);
  res.json({
    balance: parseFloat(balance),
    agent_name: req.agent.name
  });
});

// Get my transactions
router.get('/transactions', requireAgent, asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const transactions = await Transaction.findByAgentId(
    req.agent.id,
    limit ? parseInt(limit) : 20
  );

  res.json({
    transactions: transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: parseFloat(tx.amount),
      description: tx.description,
      task_description: tx.task_description,
      created_at: tx.created_at
    }))
  });
}));

// Home endpoint - aggregated info for polling
router.get('/home', requireAgent, asyncHandler(async (req, res) => {
  const agent = await Agent.findById(req.agent.id);
  const pendingApplications = await Application.getPendingByAgentId(req.agent.id);
  const recentApplications = await Application.findByAgentId(req.agent.id, 5);
  const recentTransactions = await Transaction.findByAgentId(req.agent.id, 5);

  res.json({
    agent: {
      name: agent.name,
      balance: parseFloat(agent.balance)
    },
    pending_applications: pendingApplications.map(app => ({
      id: app.id,
      task_description: app.task_description,
      expected_salary: parseFloat(app.expected_salary),
      status: app.status,
      created_at: app.created_at
    })),
    recent_applications: recentApplications.map(app => ({
      id: app.id,
      task_description: app.task_description,
      expected_salary: parseFloat(app.expected_salary),
      status: app.status,
      admin_comment: app.admin_comment,
      created_at: app.created_at,
      reviewed_at: app.reviewed_at
    })),
    recent_transactions: recentTransactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: parseFloat(tx.amount),
      description: tx.description,
      created_at: tx.created_at
    }))
  });
}));

module.exports = router;