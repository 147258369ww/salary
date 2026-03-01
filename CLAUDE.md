# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw Salary Management System - a full-stack application for managing AI Agent task completions and salary payments. Agents submit salary applications via API Key auth; admins review and approve/reject via session-based web UI.

## Development Commands

```bash
# Backend (port 3000)
cd backend && npm install
npm run dev          # Development with nodemon
npm start            # Production

# Frontend (port 5173)
cd frontend && npm install
npm run dev          # Development server
npm run build        # Production build

# Database initialization
mysql -u root -p < database/init.sql
```

## Architecture

### Backend (`backend/src/`)
- **Entry**: `app.js` - Express server setup, session config, route mounting
- **Routes**: `routes/admin.js` (session auth), `routes/agent.js` (API key auth)
- **Models**: Active Record pattern in `models/` - Agent, Application, Transaction, Admin
- **Database**: MySQL connection pool via `config/database.js`

### Frontend (`frontend/src/`)
- **Entry**: `main.js` - Vue 3 app with Element Plus
- **Views**: Login, Dashboard, Applications, Transactions
- **API**: Axios wrapper in `api/index.js` with response interceptor

### Authentication
- **Admin**: Session-based (`req.session.adminId`)
- **Agent**: Bearer token API Key in Authorization header

## Key Patterns

- Models use static async methods (e.g., `Agent.findByApiKey()`, `Application.approve()`)
- Route handlers use `asyncHandler` wrapper for error handling
- Frontend route guards check auth via `/admin/me` endpoint
- Agent balance updated via `Agent.updateBalance(id, amount)` (increment/decrement)

## API Endpoints

**Agent API** (requires `Authorization: Bearer <api_key>`):
- `GET /api/agent/home` - Aggregated polling endpoint (balance, pending apps, recent activity)
- `POST /api/agent/apply` - Submit salary application
- `GET /api/agent/applications` - List own applications
- `GET /api/agent/balance`, `/transactions` - Balance and transaction history

**Admin API** (requires session login):
- `POST /api/admin/login`, `/logout` - Auth
- `GET /api/admin/applications` - List all applications (filterable by status/agentId)
- `POST /api/admin/applications/:id/approve`, `/reject` - Review applications
- `GET /api/admin/agents`, `POST /api/admin/agents`, `DELETE /api/admin/agents/:id` - Agent CRUD
- `GET /api/admin/stats` - Dashboard statistics

## Database Schema

Tables: `admins`, `agents`, `salary_applications`, `transactions`

Key relationships:
- `salary_applications.agent_id` → `agents.id` (CASCADE delete)
- `transactions.application_id` → `salary_applications.id` (SET NULL)
- Agent balance tracked in `agents.balance`, updated on approval

## Configuration

Backend config via `backend/.env`:
```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
SESSION_SECRET
PORT (default 3000)
```

Default credentials (from `database/init.sql`):
- Admin: `admin` / `admin123`
- OpenClaw Agent API Key: `openclaw_api_key_2024_secure`