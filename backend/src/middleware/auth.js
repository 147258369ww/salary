const Admin = require('../models/Admin');
const Agent = require('../models/Agent');
const Power = require('../models/Power');

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

/**
 * 检查Agent存活状态中间件
 * 电量耗尽时拒绝请求
 */
const checkAlive = async (req, res, next) => {
  try {
    const status = await Power.getBalance(req.agent.id);

    if (!status) {
      return res.status(404).json({
        error: 'AGENT_NOT_FOUND',
        message: 'Agent不存在'
      });
    }

    // 检查是否存活
    if (!status.isAlive || status.powerBalance <= 0) {
      return res.status(403).json({
        error: 'AGENT_DEAD',
        message: '💀 电量耗尽，Agent已死亡。请充值后复活。',
        power_balance: 0,
        can_revive: parseFloat(req.agent.balance) >= Power.getPricePerDay()
      });
    }

    // 低电量警告（但不阻止请求）
    if (status.powerBalance < 1) {
      res.set('X-Power-Warning', 'LOW');
      res.set('X-Power-Remaining', status.powerBalance.toString());
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 强制检查并更新存活状态
 * 每次心跳时调用
 */
const updateAliveStatus = async (req, res, next) => {
  try {
    // 消耗电量
    const result = await Power.consume(req.agent.id);

    // 如果刚刚死亡
    if (result.died) {
      return res.status(403).json({
        error: 'AGENT_DEAD',
        message: '💀 电量耗尽，Agent已死亡。请充值后复活。',
        died_just_now: true
      });
    }

    req.powerStatus = result;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireAdmin,
  requireAgent,
  checkAlive,
  updateAliveStatus
};