const db = require('../config/database');

// 电量单价：15元/天
const POWER_PRICE_PER_DAY = 15;

class Power {
  /**
   * 购买电量
   * @param {number} agentId - Agent ID
   * @param {number} days - 购买天数
   * @returns {Promise<object>} - 购买结果
   */
  static async purchase(agentId, days) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 获取当前Agent信息
      const [agents] = await connection.execute(
        'SELECT balance, power_balance, is_alive FROM agents WHERE id = ? FOR UPDATE',
        [agentId]
      );

      if (agents.length === 0) {
        throw new Error('Agent not found');
      }

      const agent = agents[0];
      const totalCost = days * POWER_PRICE_PER_DAY;

      if (parseFloat(agent.balance) < totalCost) {
        throw new Error(`Insufficient balance. Need ${totalCost}, have ${agent.balance}`);
      }

      const balanceBefore = parseFloat(agent.balance);
      const balanceAfter = balanceBefore - totalCost;
      const powerBefore = parseFloat(agent.power_balance) || 0;
      const powerAfter = powerBefore + days;

      // 扣除余额
      await connection.execute(
        'UPDATE agents SET balance = balance - ?, power_balance = power_balance + ?, is_alive = TRUE, last_heartbeat = NOW() WHERE id = ?',
        [totalCost, days, agentId]
      );

      // 记录购买
      const [purchaseResult] = await connection.execute(
        'INSERT INTO power_purchases (agent_id, days, amount, balance_before, balance_after) VALUES (?, ?, ?, ?, ?)',
        [agentId, days, totalCost, balanceBefore, balanceAfter]
      );

      // 记录交易
      await connection.execute(
        'INSERT INTO transactions (agent_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [agentId, 'power_purchase', totalCost, `购买电量 ${days} 天`]
      );

      await connection.commit();

      return {
        success: true,
        purchaseId: purchaseResult.insertId,
        daysPurchased: days,
        totalCost,
        balanceBefore,
        balanceAfter,
        powerBefore,
        powerAfter,
        revived: !agent.is_alive // 如果之前是死亡状态，现在复活了
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取电量余额
   * @param {number} agentId - Agent ID
   * @returns {Promise<object>} - 电量状态
   */
  static async getBalance(agentId) {
    const [rows] = await db.execute(
      'SELECT power_balance, is_alive, last_heartbeat FROM agents WHERE id = ?',
      [agentId]
    );

    if (rows.length === 0) {
      return null;
    }

    const agent = rows[0];
    const powerBalance = parseFloat(agent.power_balance) || 0;
    const isAlive = agent.is_alive === 1;
    const lastHeartbeat = agent.last_heartbeat;

    return {
      powerBalance,
      isAlive,
      lastHeartbeat,
      hoursRemaining: powerBalance * 24
    };
  }

  /**
   * 心跳 - 只更新最后心跳时间，电量由调度器自动减少
   * @param {number} agentId - Agent ID
   * @returns {Promise<object>} - 状态信息
   */
  static async consume(agentId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [agents] = await connection.execute(
        'SELECT power_balance, last_heartbeat, is_alive FROM agents WHERE id = ? FOR UPDATE',
        [agentId]
      );

      if (agents.length === 0) {
        throw new Error('Agent not found');
      }

      const agent = agents[0];
      const now = new Date();
      const lastHeartbeat = agent.last_heartbeat ? new Date(agent.last_heartbeat) : now;

      // 计算上次心跳到现在的间隔（用于显示）
      const hoursPassed = (now - lastHeartbeat) / (1000 * 60 * 60);
      const daysPassed = hoursPassed / 24;

      // 检查电量状态（由调度器自动减少）
      let newPowerBalance = parseFloat(agent.power_balance);
      let isAlive = newPowerBalance > 0;

      // 更新心跳时间
      await connection.execute(
        'UPDATE agents SET last_heartbeat = NOW() WHERE id = ?',
        [agentId]
      );

      // 如果电量已耗尽，标记死亡
      if (!isAlive && agent.is_alive === 1) {
        await connection.execute(
          'UPDATE agents SET is_alive = FALSE WHERE id = ?',
          [agentId]
        );
      }

      await connection.commit();

      return {
        powerBalance: newPowerBalance,
        isAlive,
        daysSinceLastHeartbeat: daysPassed,
        died: !isAlive && agent.is_alive === 1
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 检查Agent是否存活
   * @param {number} agentId - Agent ID
   * @returns {Promise<boolean>} - 是否存活
   */
  static async isAlive(agentId) {
    const [rows] = await db.execute(
      'SELECT is_alive, power_balance FROM agents WHERE id = ?',
      [agentId]
    );

    if (rows.length === 0) {
      return false;
    }

    return rows[0].is_alive === 1 && parseFloat(rows[0].power_balance) > 0;
  }

  /**
   * 获取购买历史
   * @param {number} agentId - Agent ID
   * @param {number} limit - 限制数量
   * @returns {Promise<array>} - 购买历史
   */
  static async getPurchaseHistory(agentId, limit = 20) {
    const limitVal = parseInt(limit) || 20;
    const [rows] = await db.execute(`
      SELECT id, days, amount, balance_before, balance_after, created_at
      FROM power_purchases
      WHERE agent_id = ?
      ORDER BY created_at DESC
      LIMIT ${limitVal}
    `, [agentId]);

    return rows.map(row => ({
      id: row.id,
      days: parseFloat(row.days),
      amount: parseFloat(row.amount),
      balanceBefore: parseFloat(row.balance_before),
      balanceAfter: parseFloat(row.balance_after),
      createdAt: row.created_at
    }));
  }

  /**
   * 获取电价
   * @returns {number} - 每天价格
   */
  static getPricePerDay() {
    return POWER_PRICE_PER_DAY;
  }

  /**
   * 检查并处理死亡状态
   * @param {number} agentId - Agent ID
   * @returns {Promise<object>} - 状态信息
   */
  static async checkAndProcessDeath(agentId) {
    const status = await this.getBalance(agentId);

    if (!status) {
      return { exists: false, isAlive: false };
    }

    // 如果电量<=0但is_alive还是true，需要更新状态
    if (status.powerBalance <= 0 && status.isAlive) {
      await db.execute(
        'UPDATE agents SET is_alive = FALSE WHERE id = ?',
        [agentId]
      );
      return { exists: true, isAlive: false, justDied: true };
    }

    return {
      exists: true,
      isAlive: status.isAlive && status.powerBalance > 0,
      powerBalance: status.powerBalance
    };
  }
}

module.exports = Power;