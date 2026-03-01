const Admin = require('../models/Admin');
const Agent = require('../models/Agent');

// Admin authentication middleware (session-based)
const requireAdmin = async (req, res, next) => {
  if (!req.session || !req.session.adminId) {
    return res.status(401).json({ error: 'Unauthorized - Please login' });
  }

  try {
    const admin = await Admin.findById(req.session.adminId);
    if (!admin) {
      req.session.destroy();
      return res.status(401).json({ error: 'Admin not found - Please login again' });
    }
    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
};

// Agent authentication middleware (API key)
const requireAgent = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const apiKey = authHeader.substring(7);

  try {
    const agent = await Agent.findByApiKey(apiKey);
    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.agent = agent;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireAdmin,
  requireAgent
};