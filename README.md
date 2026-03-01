# OpenClaw 工资管理系统

虚拟工资管理系统，用于管理 OpenClaw (AI Agent) 的任务完成和工资发放。

## 功能

- **Agent API**: 提交工资申请、查看余额和交易流水
- **管理后台**: 审核工资申请、管理 Agent、查看交易记录
- **轮询机制**: Agent 可定期查询申请状态

## 技术栈

- **前端**: Vue 3 + Vite + Element Plus
- **后端**: Node.js + Express
- **数据库**: MySQL
- **认证**: API Key (Agent) + Session (管理员)

## 快速开始

### 1. 初始化数据库

```bash
mysql -u root -p < database/init.sql
```

### 2. 配置后端

编辑 `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=openclaw_salary
SESSION_SECRET=your_session_secret
```

### 3. 安装依赖

```bash
# 后端
cd backend && npm install

# 前端
cd frontend && npm install
```

### 4. 启动服务

```bash
# 启动后端 (端口 3000)
cd backend && npm run dev

# 启动前端 (端口 5173)
cd frontend && npm run dev
```

### 5. 访问系统

- 前端界面: http://localhost:5173
- 默认管理员: `admin` / `admin123`

## API 文档

### Agent API (需 API Key)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/agent/me | 获取当前 Agent 信息 |
| POST | /api/agent/apply | 提交工资申请 |
| GET | /api/agent/applications | 获取申请列表 |
| GET | /api/agent/balance | 获取余额 |
| GET | /api/agent/transactions | 获取交易流水 |
| GET | /api/agent/home | 轮询入口（聚合信息） |

### 管理员 API (需登录)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/admin/login | 登录 |
| POST | /api/admin/logout | 登出 |
| GET | /api/admin/applications | 获取申请列表 |
| POST | /api/admin/applications/:id/approve | 批准申请 |
| POST | /api/admin/applications/:id/reject | 拒绝申请 |
| GET | /api/admin/agents | 获取 Agent 列表 |
| GET | /api/admin/transactions | 获取交易流水 |
| GET | /api/admin/stats | 获取统计数据 |

## 测试 API

```bash
# 测试 Agent API
curl http://localhost:3000/api/agent/home \
  -H "Authorization: Bearer openclaw_api_key_2024_secure"

# 提交工资申请
curl -X POST http://localhost:3000/api/agent/apply \
  -H "Authorization: Bearer openclaw_api_key_2024_secure" \
  -H "Content-Type: application/json" \
  -d '{"task_description":"完成任务示例","expected_salary":50}'
```

## 项目结构

```
salary/
├── backend/                 # Node.js 后端
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   ├── middleware/     # 中间件
│   │   ├── models/         # 数据模型
│   │   └── config/         # 配置
│   └── package.json
│
├── frontend/               # Vue 前端
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── api/           # API 封装
│   │   └── router/        # 路由配置
│   └── package.json
│
├── database/
│   └── init.sql           # 数据库初始化
│
└── openclaw-skill.md      # Agent Skill 文件
```

## 默认账号

- **管理员**: admin / admin123
- **OpenClaw API Key**: openclaw_api_key_2024_secure