const db = require('../config/database');

class Transaction {
  static async create(agentId, type, amount, applicationId = null, description = null) {
    const [result] = await db.execute(
      'INSERT INTO transactions (agent_id, type, amount, application_id, description) VALUES (?, ?, ?, ?, ?)',
      [agentId, type, amount, applicationId, description]
    );
    return result.insertId;
  }

  static async findByAgentId(agentId, limit = 20) {
    const limitVal = parseInt(limit) || 20;
    const [rows] = await db.execute(`
      SELECT t.*, sa.task_description
      FROM transactions t
      LEFT JOIN salary_applications sa ON t.application_id = sa.id
      WHERE t.agent_id = ?
      ORDER BY t.created_at DESC
      LIMIT ${limitVal}
    `, [agentId]);
    return rows;
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT t.*, a.name as agent_name, sa.task_description
      FROM transactions t
      JOIN agents a ON t.agent_id = a.id
      LEFT JOIN salary_applications sa ON t.application_id = sa.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.agentId) {
      query += ' AND t.agent_id = ?';
      params.push(filters.agentId);
    }

    if (filters.type) {
      query += ' AND t.type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY t.created_at DESC';

    // Use integer directly in query for LIMIT (safe since we control the value)
    const limit = parseInt(filters.limit) || 100;
    query += ` LIMIT ${limit}`;

    const [rows] = await db.execute(query, params);
    return rows;
  }

  static async getStats() {
    const [rows] = await db.execute(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as total_credits,
        SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as total_debits,
        SUM(CASE WHEN type = 'power_purchase' THEN amount ELSE 0 END) as total_power_purchases,
        SUM(CASE WHEN type = 'admin_deduct' THEN amount ELSE 0 END) as total_admin_deductions
      FROM transactions
    `);
    return rows[0];
  }

  /**
   * 创建管理员扣款交易
   */
  static async createAdminDeduct(agentId, amount, reason) {
    const [result] = await db.execute(
      'INSERT INTO transactions (agent_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [agentId, 'admin_deduct', amount, reason]
    );
    return result.insertId;
  }
}

module.exports = Transaction;