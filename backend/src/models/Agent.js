const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Agent {
  static async create(name, initialBalance = 0) {
    const apiKey = `openclaw_${uuidv4().replace(/-/g, '')}`;
    const [result] = await db.execute(
      'INSERT INTO agents (name, api_key, balance) VALUES (?, ?, ?)',
      [name, apiKey, initialBalance]
    );
    return { id: result.insertId, name, apiKey, balance: initialBalance };
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
      'SELECT id, name, balance, created_at FROM agents WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findAll() {
    const [rows] = await db.execute(
      'SELECT id, name, balance, created_at FROM agents ORDER BY created_at DESC'
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
}

module.exports = Agent;