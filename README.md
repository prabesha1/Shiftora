# This is Capstone Project I & II for GBC

Shiftora is a full‑stack scheduling, time‑tracking, and labor reporting app built with Vite + React on the front end and an Express + MongoDB API on the back end. It supports manager, admin, and employee roles, shift scheduling, clock‑in/out with breaks, tip tracking, and daily/weekly wage reports.

## Overview
- **Front end:** Vite + React + TypeScript, Tailwind v4 build, shadcn/radix UI components.
- **Back end:** Express REST API (`server/index.js`) using the MongoDB Node driver, JWT auth, bcrypt password hashing.
- **Auth & roles:** register/login, persisted JWT, dashboards per role (manager, employee, admin).
- **Core features:** employee CRUD, shift creation & deletion, live punch tracking (clock in/out & breaks), tip pool entry, daily and weekly labor/tips reporting.

## Prerequisites
- Node.js 20+ and npm (tested with npm that ships with Node 20).
- MongoDB: local `mongod` or MongoDB Atlas cluster.
- Two terminals (one for API, one for Vite dev server).

## Quick Start (local or Atlas)
1) Install deps (repo root): `npm install`  
2) Copy env template: `cp server/.env.example server/.env`  
3) Edit `server/.env` and set:
   - `MONGO_URI=` `mongodb://127.0.0.1:27017/shiftora` **or** your Atlas URI  
   - `JWT_SECRET=` strong random string  
   - `PORT=4000` (default)
4) Start MongoDB: run local `mongod` **or** ensure Atlas cluster is running and network access allows your IP.
5) Start API (from repo root): `npm run server` → listens on `http://localhost:4000`.
6) (Optional) Frontend API override: create `.env` in repo root with `VITE_API_BASE=http://localhost:4000` if you change the API host/port.
7) Start frontend (new terminal, repo root): `npm run dev` → open the shown Vite URL (usually `http://localhost:5173`).
8) Health check: `curl http://localhost:4000/api/health` should return `{"status":"ok"}`.

For a step‑by‑step Atlas vs. local walkthrough (and common pitfalls), see `docs/shiftora-detailed-setup.md`.

## Seeded demo account
- Manager: `manager@shiftora.test` / `password123` (created on first API start). Use to log into the manager dashboard immediately.

## Available npm scripts
- `npm run dev` – Vite dev server for the frontend.
- `npm run build` – production build of the frontend.
- `npm run server` – starts the Express API (`server/index.js`).

## Environment variables
- `server/.env`
  - `MONGO_URI` – Mongo connection string (local or Atlas).
  - `JWT_SECRET` – secret for signing JWTs.
  - `PORT` – API port (default 4000).
- `./.env` (frontend, optional)
  - `VITE_API_BASE` – base URL for API requests; defaults to `http://localhost:4000`.

## API surface (server/index.js)
- **Auth:** `POST /api/auth/register` (name, email, password, role), `POST /api/auth/login`.
- **Employees:** `GET /api/employees`, `POST /api/employees`, `PATCH /api/employees/:id`, `DELETE /api/employees/:id` (auth required).
- **Shifts:** `GET /api/shifts?employeeId=&start=&end=`, `POST /api/shifts`, `DELETE /api/shifts/:id`.
- **Tips:** `GET /api/tips?date=YYYY-MM-DD`, `POST /api/tips`.
- **Punches:** `GET /api/punches?employeeId=`, `POST /api/punches/clock-in`, `POST /api/punches/clock-out`, `POST /api/punches/break-start`, `POST /api/punches/break-end`.
- **Reports:** `GET /api/reports/daily?date=YYYY-MM-DD`, `GET /api/reports/overview`.
- **Health:** `GET /api/health`.

## Frontend entry points
- `src/main.tsx` – React bootstrap.
- `src/App.tsx` – route-like page switching for landing, login/signup, and dashboards.
- Key UI: `src/components/manager-dashboard.tsx`, `employee-dashboard.tsx`, `admin-dashboard.tsx`, `wages-report.tsx`, `login-page.tsx`, `landing-page.tsx`.
- API client: `src/api/client.ts` centralizes fetch calls and token storage.

## Data model (Mongo collections)
- `users` – `{ name, email, passwordHash, role }`.
- `employees` – mirrors user plus department/level/hourlyRate/status/joinDate; created alongside user registration.
- `shifts` – `{ employee, employeeId, role, startTime, endTime, date, durationHours }`.
- `punches` – `{ employeeId, employeeName, clockIn, clockOut, breaks[] }` with helper endpoints for breaks.
- `tips` – `{ amount, date, notes, createdAt }`.
- Reports aggregate the above (see `buildDailyReport` and `buildWeekly` in `server/index.js`).

## Typical workflows
- **Register & login:** use UI “Get started” or `POST /api/auth/register` then `POST /api/auth/login`; store returned JWT.
- **Manage employees:** manager/admin uses employee CRUD endpoints or UI modal to add/remove team members.
- **Schedule shifts:** manager dashboard “Add shifts” or `POST /api/shifts`; delete with `DELETE /api/shifts/:id`.
- **Track time:** employees clock in/out and breaks via `/api/punches/*`; manager dashboard shows live status.
- **Record tips:** manager adds daily tip pool via `/api/tips`; reports split tips evenly across worked employees for the day.
- **Reports:** `GET /api/reports/daily?date=` for a specific day; `GET /api/reports/overview` for today + trailing 7‑day summary.

## Troubleshooting
- **Cannot connect to Mongo:** verify `MONGO_URI`, that `mongod` is running (local) or Atlas IP access rules include your IP; check logs when running `npm run server`.
- **401 Invalid token:** ensure you include `Authorization: Bearer <token>` in protected calls; re-login if token expired.
- **CORS errors from frontend:** confirm `VITE_API_BASE` points to the running API origin and restart `npm run dev` after env changes.
- **Port in use:** change `PORT` in `server/.env` and update `VITE_API_BASE` to match.

## Additional docs
- `docs/shiftora-detailed-setup.md` – deeper setup steps (Atlas vs. local), sample cURL calls, and guidance on wiring remaining hard‑coded lists to live collections.

## Notes
- This is a student capstone; no license file is present. Add one if you plan to distribute. 

Prabesh Shrestha
moksh Chhetri
