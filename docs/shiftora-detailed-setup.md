# Shiftora Detailed Setup & Data Wiring Guide

Use this when setting up Shiftora locally or pointing it at MongoDB Atlas, creating real user accounts, and replacing the remaining hard-coded dashboard lists with live database data.

## 1) Connect the backend to MongoDB (local or Atlas)

1. **Copy env template:** `cp server/.env.example server/.env`.
2. **Set connection + secrets in `server/.env`:**
   - `MONGO_URI=`  
     - Local example: `mongodb://127.0.0.1:27017/shiftora` (uses `shiftora` DB; it is created on first write).  
     - Atlas example: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/shiftora?retryWrites=true&w=majority&appName=<appName>` (URL-encode special chars in password; set network access to your IP or `0.0.0.0/0` for testing).
   - `JWT_SECRET=` any strong random string (e.g., `openssl rand -hex 32`).
   - `PORT=4000` (leave as-is unless port is taken).
3. **Start MongoDB:**
   - Local: ensure `mongod` is running. On macOS with Homebrew: `brew services start mongodb-community` (or run `mongod --dbpath /usr/local/var/mongodb`). On Windows: start the "MongoDB" service or run `mongod` from MongoDB Community install. On Linux: start via your init system (`systemctl start mongod`).
   - Atlas: no local process needed; just confirm cluster is "Running."
4. **Install backend deps (once):** from repo root, `npm install` (already done if you see `node_modules/`).
5. **Start the API:** from repo root, `npm run server`. Backend listens on `http://localhost:4000` (or the port you set).
6. **Expose API URL to the frontend:**  
   - The frontend defaults to `http://localhost:4000`. If you changed the API port or are using Atlas behind a tunnel, create a root `.env` (next to `package.json`) with `VITE_API_BASE=http://localhost:4000` (adjust host/port as needed).  
   - Restart `npm run dev` after changing Vite env values.
7. **Quick sanity check:** once the server is up, run `curl http://localhost:4000/api/health` (or hit any public GET). A JSON response confirms the API and Mongo are reachable.

## 2) Creating real accounts (UI and API)

### A. Through the UI
1. Run frontend: from repo root, `npm run dev` and open the shown Vite URL (usually `http://localhost:5173`).
2. Click **Get started**.
3. Fill **Name, Email, Password, Role** (role decides dashboard). Submit. The app calls `POST /api/auth/register`, stores the JWT, and routes you to the correct dashboard automatically.

### B. Direct API (curl/Postman)
Use the base URL `http://localhost:4000` unless you changed it.
1. **Register:**  
   ```
   curl -X POST http://localhost:4000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{ "name":"Jane Manager", "email":"jane@example.com", "password":"pass1234", "role":"manager" }'
   ```
   Response: `{ token, role, id }`.
2. **Login:**  
   ```
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{ "email":"jane@example.com", "password":"pass1234" }'
   ```
   Save the returned `token`.
3. **Create an employee without user login (manager/admin token required):**
   ```
   curl -X POST http://localhost:4000/api/employees \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{ "name":"Jordan Lee", "email":"jordan@example.com", "role":"Host", "hourlyRate":18, "department":"Front of House", "status":"active" }'
   ```
4. **Delete an employee:** `DELETE /api/employees/:id` with the same Bearer token.
5. **Seeded demo login:** `manager@shiftora.test / password123` (role: manager). Handy for first-time checks.

## 3) Wire remaining hard-coded lists to MongoDB

Goal: replace static arrays in the manager dashboard with live collections and CRUD endpoints.

### A. Departments & Holiday/Timeoff lists
1. **Create schemas (server side):**
   - `Department`: fields like `name` (string, required), `description` (optional), `createdAt`.
   - `Timeoff` (or `Holiday`): `name`, `date`, `type` (`holiday` | `pto`), `notes`.
2. **Add REST routes (Express):** `GET /api/departments`, `POST /api/departments`, `PUT /api/departments/:id`, `DELETE /api/departments/:id`; same pattern for `/api/timeoff`.
3. **Controller logic:** simple Mongoose CRUD using the schemas above; enforce manager/admin auth middleware.
4. **Frontend fetch:** in `manager-dashboard.tsx` (or the relevant view), swap the hard-coded arrays for `useEffect` calls to the new endpoints; handle loading/error states; store data in component state/context.
5. **Seed starter data (optional):** insert a few departments and holidays so the UI isn’t empty on first load.

### B. Shift swap requests
1. **Schema:** `swap_requests` collection with `{ employeeId, shiftId, reason, status }` plus timestamps; consider `requestedBy` and `approvedBy` for auditing.
2. **Routes:**  
   - `POST /api/swaps` (create request by an employee),  
   - `GET /api/swaps` (manager/admin view of pending/approved/denied),  
   - `PATCH /api/swaps/:id` to update `status` (e.g., `pending` → `approved`/`denied`).
3. **Frontend:** drive the pending-requests UI from `GET /api/swaps` response; remove the hard-coded array and map over API data; add approve/deny actions that call `PATCH`.

### C. Revenue hookup for reports
1. **Schema:** `revenue` collection with `{ date, amount, source? }`.
2. **In `buildDailyReport` (backend reports service):** include a revenue aggregation (sum per day/week) when building the payload sent to `/api/reports` consumers.
3. **Seeding/testing:** insert sample revenue docs to confirm charts populate; verify daily/weekly report endpoints reflect the new field.

## 4) Quick verification checklist
- `.env` present in `server/` with valid `MONGO_URI`, `JWT_SECRET`, `PORT`.
- MongoDB reachable (local `mongod` running or Atlas cluster green).
- `npm run server` shows “Connected to MongoDB” and listens on `4000`.
- Frontend `.env` (if needed) defines `VITE_API_BASE`; `npm run dev` loads dashboards without console errors.
- Register/login works and returns a JWT; protected endpoints succeed with Bearer token.
- Manager dashboard lists (departments, time off, swaps) populate from API responses instead of static data.
