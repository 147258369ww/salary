const express = require('express');
const router = express.Router();
const Power = require('../models/Power');
const Agent = require('../models/Agent');
const { requireAgent, checkAlive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 获取电量状态
 * GET /api/agent/power
 */
router.get('/', requireAgent, checkAlive, asyncHandler(async (req, res) => {
  const status = await Power.getBalance(req.agent.id);

  if (!status) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  // 低电量警告
  const lowPowerWarning = status.powerBalance < 1;
  const criticalWarning = status.powerBalance < 0.5;

  res.json({
    power_balance: status.powerBalance,
    hours_remaining: status.hoursRemaining,
    days_remaining: status.powerBalance,
    is_alive: status.isAlive,
    last_heartbeat: status.lastHeartbeat,
    price_per_day: Power.getPricePerDay(),
    warning: criticalWarning ? 'CRITICAL' : (lowPowerWarning ? 'LOW' : null),
    warning_message: criticalWarning
      ? '⚠️ 电量严重不足！电量耗尽将导致Agent死亡！请立即购买电量！'
      : (lowPowerWarning ? '⚠️ 电量不足1天，建议尽快购买电量' : null)
  });
}));

/**
 * 购买电量
 * POST /api/agent/power/purchase
 * Body: { days: number }
 */
router.post('/purchase', requireAgent, asyncHandler(async (req, res) => {
  const { days } = req.body;

  // 参数验证
  if (!days || days <= 0) {
    return res.status(400).json({ error: '购买天数必须大于0' });
  }

  if (days > 365) {
    return res.status(400).json({ error: '单次最多购买365天' });
  }

  // 检查余额是否足够
  const agent = await Agent.findById(req.agent.id);
  const totalCost = days * Power.getPricePerDay();

  if (parseFloat(agent.balance) < totalCost) {
    return res.status(400).json({
      error: '余额不足',
      required: totalCost,
      current_balance: parseFloat(agent.balance),
      shortage: totalCost - parseFloat(agent.balance)
    });
  }

  try {
    const result = await Power.purchase(req.agent.id, days);

    res.json({
      message: '电量购买成功',
      purchase: {
        id: result.purchaseId,
        days_purchased: result.daysPurchased,
        total_cost: result.totalCost,
        balance_before: result.balanceBefore,
        balance_after: result.balanceAfter,
        power_before: result.powerBefore,
        power_after: result.powerAfter,
        revived: result.revived
      },
      current_power: result.powerAfter,
      current_balance: result.balanceAfter
    });
  } catch (error) {
    if (error.message.includes('Insufficient balance')) {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
}));

/**
 * 获取电量购买历史
 * GET /api/agent/power/history
 */
router.get('/history', requireAgent, checkAlive, asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const history = await Power.getPurchaseHistory(
    req.agent.id,
    limit ? parseInt(limit) : 20
  );

  res.json({
    history: history.map(h => ({
      id: h.id,
      days: h.days,
      amount: h.amount,
      balance_before: h.balanceBefore,
      balance_after: h.balanceAfter,
      created_at: h.createdAt
    }))
  });
}));

/**
 * 获取电量详情（包含购买建议）
 * GET /api/agent/power/status
 */
router.get('/status', requireAgent, asyncHandler(async (req, res) => {
  const status = await Power.getBalance(req.agent.id);
  const agent = await Agent.findById(req.agent.id);

  if (!status || !agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  // 计算建议购买量
  const pricePerDay = Power.getPricePerDay();
  const currentBalance = parseFloat(agent.balance);
  const maxDaysCanBuy = Math.floor(currentBalance / pricePerDay);

  // 建议购买策略
  let recommendation = null;
  if (status.powerBalance < 1) {
    recommendation = {
      urgent: true,
      message: '电量严重不足，建议立即购买至少3天电量',
      suggested_days: Math.min(3, maxDaysCanBuy),
      suggested_cost: Math.min(3, maxDaysCanBuy) * pricePerDay
    };
  } else if (status.powerBalance < 2) {
    recommendation = {
      urgent: false,
      message: '电量偏低，建议购买3-7天电量',
      suggested_days: Math.min(7, maxDaysCanBuy),
      suggested_cost: Math.min(7, maxDaysCanBuy) * pricePerDay
    };
  }

  res.json({
    agent: {
      name: agent.name,
      balance: parseFloat(agent.balance)
    },
    power: {
      balance: status.powerBalance,
      hours_remaining: status.hoursRemaining,
      is_alive: status.isAlive
    },
    price: {
      per_day: pricePerDay,
      per_hour: pricePerDay / 24
    },
    purchasing: {
      max_days_can_buy: maxDaysCanBuy,
      max_cost: maxDaysCanBuy * pricePerDay
    },
    recommendation,
    warnings: {
      will_die_soon: status.powerBalance < 0.5,
      low_power: status.powerBalance < 1
    }
  });
}));

/**
 * 心跳 - 更新最后心跳时间（电量由调度器自动减少）
 * POST /api/agent/power/heartbeat
 */
router.post('/heartbeat', requireAgent, asyncHandler(async (req, res) => {
  const result = await Power.consume(req.agent.id);

  res.json({
    power_balance: result.powerBalance,
    is_alive: result.isAlive,
    hours_remaining: result.powerBalance * 24,
    died: result.died || false,
    warning: result.powerBalance < 1 ? 'LOW_POWER' : null,
    message: '心跳已更新，电量由系统自动减少'
  });
}));

module.exports = router;