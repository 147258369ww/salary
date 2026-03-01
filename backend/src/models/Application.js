const db = require('../config/database');

class Application {
  static async create(agentId, taskDescription, expectedSalary, reason = null) {
    const [result] = await db.execute(
      'INSERT INTO salary_applications (agent_id, task_description, expected_salary, reason) VALUES (?, ?, ?, ?)',
      [agentId, taskDescription, expectedSalary, reason]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.execute(`
      SELECT sa.*, a.name as agent_name
      FROM salary_applications sa
      JOIN agents a ON sa.agent_id = a.id
      WHERE sa.id = ?
    `, [id]);
    return rows[0] || null;
  }

  static async findByAgentId(agentId, limit = 20) {
    const limitVal = parseInt(limit) || 20;
    const [rows] = await db.execute(`
      SELECT * FROM salary_applications
      WHERE agent_id = ?
      ORDER BY created_at DESC
      LIMIT ${limitVal}
    `, [agentId]);
    return rows;
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT sa.*, a.name as agent_name
      FROM salary_applications sa
      JOIN agents a ON sa.agent_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND sa.status = ?';
      params.push(filters.status);
    }

    if (filters.agentId) {
      query += ' AND sa.agent_id = ?';
      params.push(filters.agentId);
    }

    query += ' ORDER BY sa.created_at DESC';

    // Use integer directly in query for LIMIT (safe since we control the value)
    const limit = parseInt(filters.limit) || 100;
    query += ` LIMIT ${limit}`;

    const [rows] = await db.execute(query, params);
    return rows;
  }

  static async getPendingByAgentId(agentId) {
    const [rows] = await db.execute(`
      SELECT * FROM salary_applications
      WHERE agent_id = ? AND status = 'pending'
      ORDER BY created_at DESC
    `, [agentId]);
    return rows;
  }

  static async approve(id, adminComment = null) {
    const [result] = await db.execute(`
      UPDATE salary_applications
      SET status = 'approved',
          admin_comment = ?,
          reviewed_at = NOW()
      WHERE id = ? AND status = 'pending'
    `, [adminComment, id]);
    return result.affectedRows > 0;
  }

  static async reject(id, adminComment = null) {
    const [result] = await db.execute(`
      UPDATE salary_applications
      SET status = 'rejected',
          admin_comment = ?,
          reviewed_at = NOW()
      WHERE id = ? AND status = 'pending'
    `, [adminComment, id]);
    return result.affectedRows > 0;
  }

  static async getStats() {
    const [rows] = await db.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'approved' THEN expected_salary ELSE 0 END) as total_approved_amount
      FROM salary_applications
    `);
    return rows[0];
  }
}

module.exports = Application;