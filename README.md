# Shiftora — Restaurant Workforce Management

Shiftora is a full-stack scheduling, time-tracking, and labor reporting app built with Vite + React on the front end and an Express + MongoDB API on the back end. It supports **admin**, **manager**, and **employee** roles, shift scheduling, clock-in/out with breaks, tip tracking, and daily/weekly wage reports.

**Capstone Project I & II — George Brown College**

## Overview

- **Front end:** Vite + React + TypeScript, Tailwind v4, shadcn/Radix UI components
- **Back end:** Express 5 REST API (`server/index.js`) with MongoDB native driver, JWT auth, bcrypt password hashing
- **Auth & roles:** Register/login with persisted JWT; role-based dashboards (admin, manager, employee)
- **Security:** Role-based access control (RBAC) middleware on all sensitive endpoints; admin accounts can only be created via seed
- **Core features:** Employee CRUD, shift scheduling, live punch tracking (clock in/out & breaks), tip pool entry, daily/weekly labor & tip reports

## Features by Role

### Admin Panel
- Full dashboard with live employee status, financial analytics, and payroll summary
- **Employee management** with search/filter, promote/demote, and bulk department reassignment
- **Activity/Audit Log** tracking all system actions with timestamps
- **Editable System Settings** (business hours, tip distribution, overtime threshold, payroll cycle)
- **Employee attendance history** — click any employee to view their full punch record
- **CSV export** of employee list
- **Financial date range picker** for custom analytics
- **Notification center** with overtime and long-break alerts
- **Dark mode** toggle
- Toast notifications with distinct colors for success, error, and info

### Manager Dashboard
- Bi-weekly schedule builder with drag-and-drop shift creation
- Live employee status tracking (working, break, off)
- Swap/leave request approval with manager notes
- Time punch records with full break details
- Tips pool management
- Profile management and password change

### Employee Dashboard
- Punch in/out and break tracking with live clock display
- Shift schedule view with upcoming shifts
- Swap/leave request submission
- Weekly wages and tips breakdown with payment history
- Profile and password management

## Prerequisites

- **Node.js 20+** and npm
- **MongoDB:** local `mongod` or MongoDB Atlas cluster
- Two terminals (one for API, one for Vite dev server)

## Quick Start

### macOS / Linux

```bash
npm install
cp server/.env.example server/.env
# Edit server/.env — set MONGO_URI, JWT_SECRET, PORT
npm run server    # Terminal 1 — starts API on http://localhost:4000
npm run dev       # Terminal 2 — starts Vite on http://localhost:3000
```

### Windows (PowerShell)

```powershell
npm install
Copy-Item server\.env.example server\.env
# Edit server\.env — set MONGO_URI, JWT_SECRET, PORT
npm run server    # Terminal 1 — starts API on http://localhost:4000
npm run dev       # Terminal 2 — starts Vite on http://localhost:3000
```

### Environment Setup

Edit `server/.env` and set:
- `MONGO_URI=mongodb://127.0.0.1:27017/shiftora` (or your Atlas URI)
- `JWT_SECRET=` a strong random string (e.g., generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `PORT=4000` (default)

Health check: open `http://localhost:4000/api/health` — should return `{"status":"ok"}`.

## Seeded Demo Accounts

Created automatically on first API start:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@shiftora.test` | `password123` |
| Manager | `manager@shiftora.test` | `password123` |
| Employee | `employee@shiftora.test` | `password123` |

> **Note:** Admin accounts cannot be created via the signup form. Only the seeded admin or future admin-invite features can create admin users.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (frontend) |
| `npm run build` | Production build of the frontend |
| `npm run server` | Start the Express API (`server/index.js`) |

## Environment Variables

### `server/.env`
| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/shiftora` |
| `JWT_SECRET` | Secret for signing JWTs | `dev-shiftora-secret` (insecure) |
| `PORT` | API port | `4000` |

### `.env` (frontend, optional)
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE` | Base URL for API requests | Uses Vite proxy in dev |

## API Surface

### Auth
- `POST /api/auth/register` — Create account (admin role restricted)
- `POST /api/auth/login` — Login and receive JWT
- `PATCH /api/auth/change-password` — Change password (auth required)

### Employees (admin/manager only for mutations)
- `GET /api/employees` — List all employees
- `POST /api/employees` — Create employee with login account
- `PATCH /api/employees/:id` — Update employee fields
- `DELETE /api/employees/:id` — Remove employee and associated user account

### Shifts (admin/manager only for mutations)
- `GET /api/shifts?employeeId=&start=&end=` — List shifts
- `POST /api/shifts` — Create shift
- `DELETE /api/shifts/:id` — Delete shift

### Tips (admin/manager only for creation)
- `GET /api/tips?date=YYYY-MM-DD` — List tips
- `POST /api/tips` — Add tip pool entry

### Punches
- `GET /api/punches?employeeId=` — List punch records
- `POST /api/punches/clock-in` — Clock in
- `POST /api/punches/clock-out` — Clock out
- `POST /api/punches/break-start` — Start break
- `POST /api/punches/break-end` — End break

### Requests (admin/manager only for approval)
- `GET /api/requests?status=` — List requests
- `POST /api/requests` — Create swap/leave request
- `PATCH /api/requests/:id` — Approve/decline request

### Admin-Only Endpoints
- `GET /api/audit-log?limit=` — View activity log
- `GET /api/settings` — Read system settings
- `PATCH /api/settings` — Update system settings
- `GET /api/notifications` — Get system alerts (overtime, long breaks)

### Reports
- `GET /api/reports/daily?date=YYYY-MM-DD` — Daily report
- `GET /api/reports/overview` — Today + weekly summary
- `GET /api/reports/employee/weekly?employeeId=&periods=` — Employee weekly report

### Health
- `GET /api/health` — Database connection status

## Data Model (MongoDB Collections)

| Collection | Fields |
|-----------|--------|
| `users` | name, email, passwordHash, role, dob, address, phone |
| `employees` | userId, name, email, role, department, level, hourlyRate, status, joinDate |
| `shifts` | employee, employeeId, role, startTime, endTime, date, durationHours |
| `punches` | employeeId, employeeName, clockIn, clockOut, breaks[] |
| `tips` | amount, date, notes, createdAt |
| `requests` | employee, employeeId, shift, role, reason, type, status, managerNote |
| `audit_log` | actor, action, target, details, createdAt |
| `settings` | key, value, updatedAt |

Database indexes are automatically created on startup for optimal query performance.

## Cross-Platform Compatibility

This project works on both **macOS** and **Windows**:
- All npm scripts use cross-platform commands (`vite`, `node`)
- File paths use `path.resolve()` and `path.join()`
- `.gitattributes` normalizes line endings (LF) across platforms
- No shell-specific scripts or OS-dependent commands in the codebase

## Troubleshooting

- **"Cannot reach server":** Start the API first (`npm run server`), then the frontend (`npm run dev`)
- **Cannot connect to MongoDB:** Verify `MONGO_URI` is correct and `mongod` is running (local) or Atlas IP access includes your IP
- **401 Invalid token:** Re-login; tokens expire after 12 hours
- **CORS errors:** Confirm `VITE_API_BASE` points to the running API and restart `npm run dev` after env changes
- **Port in use:** Change `PORT` in `server/.env` and update proxy in `vite.config.ts`

## Additional Docs

- `docs/shiftora-detailed-setup.md` — Detailed setup guide for Atlas vs. local MongoDB

## Authors

- Prabesh Shrestha
- Moksh Chhetri
