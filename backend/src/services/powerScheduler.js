const db = require('../config/database');

/**
 * 电量自动消耗调度器
 * 每小时自动减少所有存活 Agent 的电量
 */

// 每小时消耗的电量比例（1天=24小时）
const HOURS_PER_DAY = 24;

/**
 * 对所有存活的 Agent 执行电量消耗
 */
async function consumeAllPower() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 获取所有存活的 Agent
    const [agents] = await connection.execute(
      'SELECT id, power_balance, is_alive FROM agents WHERE is_alive = 1 AND power_balance > 0'
    );

    const hourFraction = 1 / HOURS_PER_DAY; // 每小时消耗 1/24 天电量
    let updated = 0;
    let died = 0;

    for (const agent of agents) {
      const newPowerBalance = parseFloat(agent.power_balance) - hourFraction;
      const isAlive = newPowerBalance > 0;

      await connection.execute(
        'UPDATE agents SET power_balance = ?, is_alive = ? WHERE id = ?',
        [Math.max(0, newPowerBalance), isAlive ? 1 : 0, agent.id]
      );

      if (isAlive) {
        updated++;
      } else {
        died++;
      }
    }

    await connection.commit();

    if (agents.length > 0) {
      console.log(`[PowerScheduler] 电量消耗: 检查了 ${agents.length} 个 Agent, 更新了 ${updated} 个, 死亡 ${died} 个`);
    }

    return { checked: agents.length, updated, died };
  } catch (error) {
    await connection.rollback();
    console.error('[PowerScheduler] 电量消耗失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 启动电量调度器
 * @param {number} intervalMs - 间隔时间（毫秒），默认 1 小时
 */
function startPowerScheduler(intervalMs = 60 * 60 * 1000) {
  console.log(`[PowerScheduler] 启动电量自动消耗调度器，间隔: ${intervalMs / 1000} 秒`);

  // 立即执行一次
  consumeAllPower().catch(console.error);

  // 设置定时执行
  const intervalId = setInterval(() => {
    consumeAllPower().catch(console.error);
  }, intervalMs);

  return intervalId;
}

/**
 * 停止电量调度器
 * @param {number} intervalId - setInterval 返回的 ID
 */
function stopPowerScheduler(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('[PowerScheduler] 电量调度器已停止');
  }
}

module.exports = {
  startPowerScheduler,
  stopPowerScheduler,
  consumeAllPower
};