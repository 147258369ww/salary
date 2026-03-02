const db = require('../config/database');

// 允许的自主任务类型
const ALLOWED_AUTO_TASKS = {
  'document_generation': {
    name: '文档生成',
    minSalary: 5,
    maxSalary: 50,
    description: '生成各类文档、报告、总结等',
    examples: ['周报生成', '会议纪要', '项目文档']
  },
  'data_processing': {
    name: '数据处理',
    minSalary: 5,
    maxSalary: 30,
    description: '数据整理、格式转换、数据清洗等',
    examples: ['数据格式化', '表格整理', '数据校验']
  },
  'code_review': {
    name: '代码审查',
    minSalary: 10,
    maxSalary: 100,
    description: '代码审查、优化建议、问题检测等',
    examples: ['代码优化', '安全检查', '性能分析']
  },
  'translation': {
    name: '翻译任务',
    minSalary: 5,
    maxSalary: 40,
    description: '文本翻译、本地化处理等',
    examples: ['中英翻译', '文档本地化', '术语翻译']
  },
  'summarization': {
    name: '内容摘要',
    minSalary: 3,
    maxSalary: 20,
    description: '长文摘要、要点提取、内容精简等',
    examples: ['文章摘要', '会议总结', '要点提取']
  },
  'research': {
    name: '信息研究',
    minSalary: 5,
    maxSalary: 50,
    description: '信息搜集、资料整理、竞品分析等',
    examples: ['市场调研', '技术调研', '竞品分析']
  }
};

// 频率限制：每小时最多提交数量
const HOURLY_LIMIT = 3;
// 电量门槛：电量低于此值禁止创建自主任务
const POWER_THRESHOLD = 0.5;

class AutoTask {
  /**
   * 获取允许的任务类型列表
   */
  static getAllowedTaskTypes() {
    return Object.entries(ALLOWED_AUTO_TASKS).map(([key, value]) => ({
      type: key,
      name: value.name,
      min_salary: value.minSalary,
      max_salary: value.maxSalary,
      description: value.description,
      examples: value.examples
    }));
  }

  /**
   * 验证任务类型和金额
   */
  static validateTask(taskType, expectedSalary) {
    if (!ALLOWED_AUTO_TASKS[taskType]) {
      return { valid: false, error: `不支持的任务类型: ${taskType}` };
    }

    const taskConfig = ALLOWED_AUTO_TASKS[taskType];
    if (expectedSalary < taskConfig.minSalary || expectedSalary > taskConfig.maxSalary) {
      return {
        valid: false,
        error: `金额超出范围，${taskConfig.name}任务金额应在 ${taskConfig.minSalary}-${taskConfig.maxSalary} 元之间`
      };
    }

    return { valid: true, config: taskConfig };
  }

  /**
   * 检查频率限制
   */
  static async checkRateLimit(agentId) {
    const [rows] = await db.execute(`
      SELECT COUNT(*) as count
      FROM auto_tasks
      WHERE agent_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `, [agentId]);

    const count = rows[0].count;
    return {
      allowed: count < HOURLY_LIMIT,
      current: count,
      limit: HOURLY_LIMIT,
      remaining: Math.max(0, HOURLY_LIMIT - count)
    };
  }

  /**
   * 创建自主任务
   */
  static async create(agentId, taskType, taskDescription, expectedSalary) {
    // 验证
    const validation = this.validateTask(taskType, expectedSalary);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 检查频率限制
    const rateLimit = await this.checkRateLimit(agentId);
    if (!rateLimit.allowed) {
      throw new Error(`频率限制：每小时最多创建 ${HOURLY_LIMIT} 个自主任务，请稍后再试`);
    }

    const [result] = await db.execute(
      'INSERT INTO auto_tasks (agent_id, task_type, task_description, expected_salary) VALUES (?, ?, ?, ?)',
      [agentId, taskType, taskDescription, expectedSalary]
    );

    return {
      id: result.insertId,
      taskType,
      taskDescription,
      expectedSalary,
      status: 'pending'
    };
  }

  /**
   * 获取Agent的自主任务列表
   */
  static async findByAgentId(agentId, limit = 20) {
    const limitVal = parseInt(limit) || 20;
    const [rows] = await db.execute(`
      SELECT at.*, sa.status as application_status
      FROM auto_tasks at
      LEFT JOIN salary_applications sa ON at.application_id = sa.id
      WHERE at.agent_id = ?
      ORDER BY at.created_at DESC
      LIMIT ${limitVal}
    `, [agentId]);

    return rows.map(row => ({
      id: row.id,
      task_type: row.task_type,
      task_description: row.task_description,
      expected_salary: parseFloat(row.expected_salary),
      status: row.status,
      application_id: row.application_id,
      application_status: row.application_status,
      created_at: row.created_at,
      submitted_at: row.submitted_at
    }));
  }

  /**
   * 获取待提交的自主任务
   */
  static async getPendingByAgentId(agentId) {
    const [rows] = await db.execute(`
      SELECT * FROM auto_tasks
      WHERE agent_id = ? AND status = 'pending'
      ORDER BY created_at DESC
    `, [agentId]);

    return rows;
  }

  /**
   * 提交自主任务为工资申请
   */
  static async submitAsApplication(autoTaskId, agentId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 获取自主任务
      const [tasks] = await connection.execute(
        'SELECT * FROM auto_tasks WHERE id = ? AND agent_id = ? AND status = \'pending\' FOR UPDATE',
        [autoTaskId, agentId]
      );

      if (tasks.length === 0) {
        throw new Error('自主任务不存在或已提交');
      }

      const task = tasks[0];

      // 创建工资申请
      const [appResult] = await connection.execute(
        'INSERT INTO salary_applications (agent_id, task_description, expected_salary, reason) VALUES (?, ?, ?, ?)',
        [agentId, `[自主任务-${task.task_type}] ${task.task_description}`, task.expected_salary, 'Agent自主申请']
      );
      const applicationId = appResult.insertId;

      // 更新自主任务状态
      await connection.execute(
        'UPDATE auto_tasks SET status = \'submitted\', application_id = ?, submitted_at = NOW() WHERE id = ?',
        [applicationId, autoTaskId]
      );

      await connection.commit();

      return {
        success: true,
        autoTaskId,
        applicationId,
        expectedSalary: parseFloat(task.expected_salary)
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 取消自主任务
   */
  static async cancel(autoTaskId, agentId) {
    const [result] = await db.execute(
      'UPDATE auto_tasks SET status = \'cancelled\' WHERE id = ? AND agent_id = ? AND status = \'pending\'',
      [autoTaskId, agentId]
    );

    return result.affectedRows > 0;
  }

  /**
   * 获取电量门槛
   */
  static getPowerThreshold() {
    return POWER_THRESHOLD;
  }
}

module.exports = AutoTask;