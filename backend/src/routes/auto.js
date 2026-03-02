const express = require('express');
const router = express.Router();
const AutoTask = require('../models/AutoTask');
const Power = require('../models/Power');
const Agent = require('../models/Agent');
const { requireAgent, checkAlive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 获取可用的自主任务类型
 * GET /api/agent/auto-tasks/types
 */
router.get('/types', requireAgent, checkAlive, (req, res) => {
  const types = AutoTask.getAllowedTaskTypes();
  res.json({
    task_types: types,
    hourly_limit: 3,
    power_threshold: AutoTask.getPowerThreshold()
  });
});

/**
 * 创建自主任务
 * POST /api/agent/auto-tasks/create
 * Body: { task_type, task_description, expected_salary }
 */
router.post('/create', requireAgent, checkAlive, asyncHandler(async (req, res) => {
  const { task_type, task_description, expected_salary } = req.body;

  // 参数验证
  if (!task_type) {
    return res.status(400).json({ error: '任务类型必填' });
  }

  if (!task_description || task_description.trim().length < 10) {
    return res.status(400).json({ error: '任务描述至少10个字符' });
  }

  if (!expected_salary || expected_salary <= 0) {
    return res.status(400).json({ error: '期望工资必须大于0' });
  }

  // 检查电量是否足够
  const powerStatus = await Power.getBalance(req.agent.id);
  if (powerStatus.powerBalance < AutoTask.getPowerThreshold()) {
    return res.status(403).json({
      error: '电量不足',
      message: `电量低于 ${AutoTask.getPowerThreshold()} 天，无法创建自主任务。请先购买电量！`,
      current_power: powerStatus.powerBalance,
      threshold: AutoTask.getPowerThreshold()
    });
  }

  // 检查频率限制
  const rateLimit = await AutoTask.checkRateLimit(req.agent.id);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: '频率限制',
      message: `每小时最多创建 ${rateLimit.limit} 个自主任务`,
      current: rateLimit.current,
      limit: rateLimit.limit
    });
  }

  try {
    const task = await AutoTask.create(
      req.agent.id,
      task_type,
      task_description,
      expected_salary
    );

    res.status(201).json({
      message: '自主任务创建成功',
      task: {
        id: task.id,
        task_type: task.taskType,
        task_description: task.taskDescription,
        expected_salary: task.expectedSalary,
        status: task.status,
        remaining_quota: rateLimit.remaining - 1
      }
    });
  } catch (error) {
    if (error.message.includes('不支持的任务类型') || error.message.includes('金额超出范围')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('频率限制')) {
      return res.status(429).json({ error: error.message });
    }
    throw error;
  }
}));

/**
 * 获取我的自主任务列表
 * GET /api/agent/auto-tasks
 */
router.get('/', requireAgent, checkAlive, asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const tasks = await AutoTask.findByAgentId(
    req.agent.id,
    limit ? parseInt(limit) : 20
  );

  res.json({ tasks });
}));

/**
 * 提交自主任务为工资申请
 * POST /api/agent/auto-tasks/:id/submit
 */
router.post('/:id/submit', requireAgent, checkAlive, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await AutoTask.submitAsApplication(parseInt(id), req.agent.id);

    res.json({
      message: '自主任务已提交为工资申请',
      auto_task_id: result.autoTaskId,
      application_id: result.applicationId,
      expected_salary: result.expectedSalary,
      status: 'pending'
    });
  } catch (error) {
    if (error.message.includes('不存在或已提交')) {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
}));

/**
 * 取消自主任务
 * DELETE /api/agent/auto-tasks/:id
 */
router.delete('/:id', requireAgent, checkAlive, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cancelled = await AutoTask.cancel(parseInt(id), req.agent.id);

  if (!cancelled) {
    return res.status(404).json({ error: '任务不存在或已提交/已取消' });
  }

  res.json({ message: '自主任务已取消', task_id: id });
}));

/**
 * 检查是否可以创建自主任务
 * GET /api/agent/auto-tasks/check
 */
router.get('/check', requireAgent, asyncHandler(async (req, res) => {
  const powerStatus = await Power.getBalance(req.agent.id);
  const rateLimit = await AutoTask.checkRateLimit(req.agent.id);
  const agent = await Agent.findById(req.agent.id);

  const canCreate = powerStatus.powerBalance >= AutoTask.getPowerThreshold() && rateLimit.allowed;

  res.json({
    can_create: canCreate,
    power: {
      balance: powerStatus.powerBalance,
      threshold: AutoTask.getPowerThreshold(),
      sufficient: powerStatus.powerBalance >= AutoTask.getPowerThreshold()
    },
    rate_limit: {
      allowed: rateLimit.allowed,
      current: rateLimit.current,
      limit: rateLimit.limit,
      remaining: rateLimit.remaining
    },
    balance: parseFloat(agent.balance),
    warnings: []
  });

  if (!canCreate) {
    res.json.warnings = [];
    if (powerStatus.powerBalance < AutoTask.getPowerThreshold()) {
      res.json.warnings.push(`电量不足 ${AutoTask.getPowerThreshold()} 天，无法创建自主任务`);
    }
    if (!rateLimit.allowed) {
      res.json.warnings.push(`已达到每小时 ${rateLimit.limit} 个任务的限制`);
    }
  }
}));

module.exports = router;