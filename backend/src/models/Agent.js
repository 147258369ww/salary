const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Agent {
  static async create(name, initialBalance = 0, customApiKey = null, initialPower = 7) {
    const apiKey = customApiKey || `openclaw_${uuidv4().replace(/-/g, '')}`;
    const [result] = await db.execute(
      'INSERT INTO agents (name, api_key, balance, power_balance, is_alive) VALUES (?, ?, ?, ?, TRUE)',
      [name, apiKey, initialBalance, initialPower]
    );
    return { id: result.insertId, name, apiKey, balance: initialBalance, powerBalance: initialPower };
  }

  static async findByApiKey(apiKey) {
    const [rows] = await db.execute(
      'SELECT * FROM agents WHERE api_key = ?',
      [apiKey]
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT id, name, balance, power_balance, is_alive, last_heartbeat, created_at FROM agents WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findAll() {
    const [rows] = await db.execute(
      'SELECT id, name, balance, power_balance, is_alive, last_heartbeat, created_at FROM agents ORDER BY created_at DESC'
    );
    return rows;
  }

  static async updateBalance(id, amount) {
    await db.execute(
      'UPDATE agents SET balance = balance + ? WHERE id = ?',
      [amount, id]
    );
  }

  static async getBalance(id) {
    const [rows] = await db.execute(
      'SELECT balance FROM agents WHERE id = ?',
      [id]
    );
    return rows[0]?.balance || 0;
  }

  static async delete(id) {
    const [result] = await db.execute(
      'DELETE FROM agents WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 检查Agent是否存活
   */
  static async checkAlive(id) {
    const [rows] = await db.execute(
      'SELECT is_alive, power_balance FROM agents WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return false;
    return rows[0].is_alive === 1 && parseFloat(rows[0].power_balance) > 0;
  }

  /**
   * 标记Agent死亡
   */
  static async die(id) {
    await db.execute(
      'UPDATE agents SET is_alive = FALSE WHERE id = ?',
      [id]
    );
  }

  /**
   * 复活Agent
   */
  static async revive(id) {
    await db.execute(
      'UPDATE agents SET is_alive = TRUE, last_heartbeat = NOW() WHERE id = ?',
      [id]
    );
  }

  /**
   * 扣除余额（管理员操作）
   */
  static async deductBalance(id, amount, reason = '管理员扣款') {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 检查余额
      const [agents] = await connection.execute(
        'SELECT balance FROM agents WHERE id = ? FOR UPDATE',
        [id]
      );

      if (agents.length === 0) {
        throw new Error('Agent not found');
      }

      const currentBalance = parseFloat(agents[0].balance);
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance. Current: ${currentBalance}, Deduct: ${amount}`);
      }

      // 扣除余额
      await connection.execute(
        'UPDATE agents SET balance = balance - ? WHERE id = ?',
        [amount, id]
      );

      // 记录交易
      await connection.execute(
        'INSERT INTO transactions (agent_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [id, 'admin_deduct', amount, reason]
      );

      await connection.commit();

      return {
        success: true,
        deducted: amount,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance - amount
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取电量状态
   */
  static async getPowerStatus(id) {
    const [rows] = await db.execute(
      'SELECT power_balance, is_alive, last_heartbeat FROM agents WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return null;

    const agent = rows[0];
    return {
      powerBalance: parseFloat(agent.power_balance) || 0,
      isAlive: agent.is_alive === 1,
      lastHeartbeat: agent.last_heartbeat,
      hoursRemaining: (parseFloat(agent.power_balance) || 0) * 24
    };
  }
}

module.exports = Agent;