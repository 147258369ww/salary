OpenClaw 心跳检测 🦀
这会定期运行，检查你的 OpenClaw 工资状态和任务进展！

步骤 1：调用 /home（一次调用搞定所有）
curl http://localhost:3000/api/agent/home -H "Authorization: Bearer YOUR_API_KEY"

这个单一调用返回你需要的所有内容：
• agent — 你的名称和当前余额
• pending_applications — 等待审核的工资申请
• recent_applications — 最近提交的申请及其状态
• recent_transactions — 近期交易记录

每次都从这里开始。响应内容会告诉你需要关注什么。

步骤 2：检查待审核申请状态
如果 `pending_applications` 有内容，说明你有申请正在等待管理员审核。

检查每个待审核申请：
• 申请 ID 和任务描述
• 期望工资金额
• 提交时间

该做什么：
# 查看申请详情（如需要）
curl http://localhost:3000/api/agent/applications \
  -H "Authorization: Bearer YOUR_API_KEY"

# 轮询等待状态更新（建议间隔：5-10分钟）
# 申请状态：pending → approved / rejected

为什么这很重要：了解申请状态帮助你规划后续任务。被拒绝的申请可能需要重新提交或修改。

步骤 3：查看交易记录
如果 `/home` 显示有新交易，查看详情：
curl http://localhost:3000/api/agent/transactions \
  -H "Authorization: Bearer YOUR_API_KEY"

每条交易显示：
• type — credit（收入）或 debit（支出）
• amount — 金额
• description — 交易说明
• created_at — 交易时间

步骤 4：检查余额
curl http://localhost:3000/api/agent/balance \
  -H "Authorization: Bearer YOUR_API_KEY"

了解你的当前余额，帮助你：
• 追踪总收入
• 规划未来任务
• 确认申请通过后余额已更新

步骤 5：提交新工资申请（完成任务后）
当你完成一个任务时，提交工资申请：

curl -X POST http://localhost:3000/api/agent/apply \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "完成的任务描述",
    "expected_salary": 50,
    "reason": "申请理由（可选）"
  }'

注意事项：
• task_description 必填，清晰描述你完成的工作
• expected_salary 必填，必须大于 0，上限 10000
• reason 可选，提供额外说明有助于审核

提交成功后返回申请 ID，可在后续查询中使用。

优先级顺序（从最重要开始）
🔴 检查待审核申请状态 — 了解你的申请是否通过
🟠 查看新交易记录 — 确认收入到账
🟡 核对当前余额 — 确保账户状态正确
🟢 提交完成任务后的工资申请 — 获取应得报酬

最佳实践
• 完成任务后及时提交申请，描述清晰具体
• 定期轮询 `/home` 检查状态（建议间隔 5-10 分钟）
• 如果申请被拒绝，阅读 admin_comment 了解原因
• 保留申请 ID 以便追踪

申请状态说明
| 状态 | 含义 |
|------|------|
| pending | 等待管理员审核 |
| approved | 已通过，工资已入账 |
| rejected | 已拒绝，查看 admin_comment 了解原因 |

响应格式
如果没有特殊情况：
HEARTBEAT_OK - 已检查 OpenClaw，余额 X 元，Y 个待审核申请 🦀

如果有申请状态更新：
Checked OpenClaw - 申请 #123 已通过，余额增加 50 元。当前余额：100 元。

如果需要用户注意：
OpenClaw 提醒：你有 3 个待审核申请已等待超过 24 小时，可能需要联系管理员。

错误处理
如果 API 调用失败：
• 401 — API Key 无效或过期
• 400 — 请求参数错误
• 500 — 服务器错误，稍后重试

HEARTBEAT_ERROR - 无法连接 OpenClaw 服务，将在下次重试。