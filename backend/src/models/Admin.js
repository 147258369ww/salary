const db = require('../config/database');
const bcrypt = require('bcryptjs');

class Admin {
  static async create(username, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );
    return result.insertId;
  }

  static async findByUsername(username) {
    const [rows] = await db.execute(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT id, username, created_at FROM admins WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async verifyPassword(username, password) {
    const admin = await this.findByUsername(username);
    if (!admin) return null;

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) return null;

    return { id: admin.id, username: admin.username };
  }

  static async findAll() {
    const [rows] = await db.execute(
      'SELECT id, username, created_at FROM admins ORDER BY created_at DESC'
    );
    return rows;
  }
}

module.exports = Admin;