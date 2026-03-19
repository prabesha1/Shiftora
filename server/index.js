const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shiftora';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-shiftora-secret';
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET not set — using insecure default. Set JWT_SECRET in .env for production.');
}

app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json());

let client;
let db;
let seeded = false;

const MINUTES_IN_DAY = 24 * 60;

const startOfWeekMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toMinutes = (time) => {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if ([hours, minutes].some((value) => Number.isNaN(value))) return null;
  return hours * 60 + minutes;
};

const calculateDurationHours = (startTime, endTime) => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null || end === start) return 0;
  const adjustedEnd = end < start ? end + MINUTES_IN_DAY : end;
  return Math.round(((adjustedEnd - start) / 60) * 100) / 100;
};

async function getDb() {
  if (db) return db;
  client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  db = client.db();
  console.log('Connected to MongoDB');

  await ensureIndexes(db);

  if (!seeded) {
    await seed(db);
    seeded = true;
  }
  return db;
}

async function ensureIndexes(database) {
  try {
    await database.collection('users').createIndex({ email: 1 }, { unique: true });
    await database.collection('employees').createIndex({ email: 1 });
    await database.collection('employees').createIndex({ userId: 1 });
    await database.collection('punches').createIndex({ employeeId: 1 });
    await database.collection('punches').createIndex({ clockIn: -1 });
    await database.collection('shifts').createIndex({ date: 1 });
    await database.collection('shifts').createIndex({ employeeId: 1 });
    await database.collection('tips').createIndex({ date: 1 });
    await database.collection('requests').createIndex({ status: 1 });
    await database.collection('audit_log').createIndex({ createdAt: -1 });
    await database.collection('settings').createIndex({ key: 1 }, { unique: true });
  } catch {
    // indexes may already exist
  }
}

const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: '12h',
  });

// ── Middleware ──────────────────────────────────────────────

const authMiddleware = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'Missing auth header' });
  const [, token] = auth.split(' ');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};

// Helper: write to audit log
async function logAction(database, { actor, action, target, details }) {
  try {
    await database.collection('audit_log').insertOne({
      actor: actor || 'system',
      action,
      target: target || '',
      details: details || '',
      createdAt: new Date(),
    });
  } catch {
    // non-critical — don't crash if logging fails
  }
}

// ── Health ──────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  try {
    const database = await getDb();
    await database.command({ ping: 1 });
    const collections = await database.listCollections().toArray();
    res.json({
      status: 'ok',
      database: 'connected',
      collections: collections.map((c) => c.name),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', message: error.message });
  }
});

// ── AUTH ────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'employee', hourlyRate = 16 } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

  const safeRole = (role === 'manager' || role === 'employee') ? role : 'employee';

  const database = await getDb();
  const existing = await database.collection('users').findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const userDoc = { name, email, passwordHash, role: safeRole };
  const userResult = await database.collection('users').insertOne(userDoc);

  await database.collection('employees').insertOne({
    userId: userResult.insertedId,
    name,
    email,
    role: safeRole,
    department: 'Front of House',
    level: safeRole === 'manager' ? 'Manager' : 'Employee',
    hourlyRate,
    status: 'active',
    joinDate: new Date().toISOString(),
  });

  await logAction(database, { actor: name, action: 'register', target: email, details: `New ${safeRole} account created` });

  const token = signToken({ ...userDoc, _id: userResult.insertedId });
  res.json({ id: userResult.insertedId.toString(), name, email, role: safeRole, token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Missing credentials' });
  const database = await getDb();
  const user = await database.collection('users').findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
  const token = signToken(user);
  res.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    token,
  });
});

app.patch('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password required' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
  const database = await getDb();
  const user = await database.collection('users').findOne({ _id: new ObjectId(req.user.id) });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await database.collection('users').updateOne(
    { _id: new ObjectId(req.user.id) },
    { $set: { passwordHash } }
  );
  res.json({ message: 'Password updated successfully' });
});

// ── EMPLOYEES CRUD ─────────────────────────────────────────

app.get('/api/employees', authMiddleware, async (_req, res) => {
  const database = await getDb();
  const employees = await database.collection('employees').find().toArray();
  res.json(employees);
});

app.post('/api/employees', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const { name, email, password, role, department, level, hourlyRate } = req.body || {};
  if (!name || !email) return res.status(400).json({ message: 'Name and email required' });
  const database = await getDb();

  const existingUser = await database.collection('users').findOne({ email });
  if (existingUser) return res.status(400).json({ message: 'Email already registered' });

  let userId = null;
  if (password && password.length >= 6) {
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role === 'Manager' ? 'manager' : 'employee';
    const userResult = await database.collection('users').insertOne({
      name,
      email,
      passwordHash,
      role: userRole,
    });
    userId = userResult.insertedId;
  }

  const employeeDoc = {
    userId,
    name,
    email,
    role: role || 'Server',
    department: department || 'Front of House',
    level: level || 'Employee',
    hourlyRate: Number(hourlyRate) || 16,
    status: 'active',
    joinDate: new Date().toISOString(),
  };
  const result = await database.collection('employees').insertOne(employeeDoc);

  await logAction(database, { actor: req.user.name, action: 'create_employee', target: name, details: `Added ${role || 'Server'} in ${department || 'Front of House'}` });

  res.status(201).json({ _id: result.insertedId, ...employeeDoc });
});

app.patch('/api/employees/:id', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const allowedFields = ['name', 'email', 'role', 'department', 'level', 'hourlyRate', 'status', 'phone', 'dob', 'address'];
  const updates = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }
  const database = await getDb();
  await database
    .collection('employees')
    .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });
  const emp = await database.collection('employees').findOne({ _id: new ObjectId(req.params.id) });
  if (emp?.userId) {
    const userUpdates = {};
    if (updates.name) userUpdates.name = updates.name;
    if (updates.level === 'Manager') userUpdates.role = 'manager';
    else if (updates.level === 'Employee') userUpdates.role = 'employee';
    if (Object.keys(userUpdates).length > 0) {
      try {
        await database.collection('users').updateOne(
          { _id: emp.userId },
          { $set: userUpdates }
        );
      } catch (err) {
        console.error('Failed to sync user record:', err.message);
      }
    }
  }

  await logAction(database, { actor: req.user.name, action: 'update_employee', target: emp?.name || req.params.id, details: `Updated fields: ${Object.keys(updates).join(', ')}` });

  res.json({ updated: true });
});

// ── PROFILE ────────────────────────────────────────────────

app.get('/api/profile', authMiddleware, async (req, res) => {
  const database = await getDb();
  const user = await database.collection('users').findOne({ _id: new ObjectId(req.user.id) });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const employee = await database.collection('employees').findOne({ userId: new ObjectId(req.user.id) });
  res.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    dob: employee?.dob || user.dob || '',
    address: employee?.address || user.address || '',
    phone: employee?.phone || user.phone || '',
    employeeId: employee?._id?.toString(),
  });
});

app.patch('/api/profile', authMiddleware, async (req, res) => {
  const { name, dob, address, phone } = req.body || {};
  const database = await getDb();

  const userUpdates = {};
  if (name !== undefined) userUpdates.name = name;
  if (dob !== undefined) userUpdates.dob = dob;
  if (address !== undefined) userUpdates.address = address;
  if (phone !== undefined) userUpdates.phone = phone;

  if (Object.keys(userUpdates).length > 0) {
    await database.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: userUpdates }
    );
  }

  const employee = await database.collection('employees').findOne({ userId: new ObjectId(req.user.id) });
  if (employee) {
    const empUpdates = {};
    if (name !== undefined) empUpdates.name = name;
    if (dob !== undefined) empUpdates.dob = dob;
    if (address !== undefined) empUpdates.address = address;
    if (phone !== undefined) empUpdates.phone = phone;
    if (Object.keys(empUpdates).length > 0) {
      await database.collection('employees').updateOne(
        { _id: employee._id },
        { $set: empUpdates }
      );
    }
  }
  res.json({ updated: true });
});

// ── DELETE EMPLOYEE (with user cleanup) ────────────────────

app.delete('/api/employees/:id', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const database = await getDb();
  const emp = await database.collection('employees').findOne({ _id: new ObjectId(req.params.id) });
  if (!emp) return res.status(404).json({ message: 'Employee not found' });

  if (emp.userId) {
    await database.collection('users').deleteOne({ _id: emp.userId });
  }
  await database.collection('employees').deleteOne({ _id: new ObjectId(req.params.id) });

  await logAction(database, { actor: req.user.name, action: 'delete_employee', target: emp.name || req.params.id, details: 'Employee and user account removed' });

  res.json({ deleted: true });
});

// ── SHIFTS ─────────────────────────────────────────────────

app.get('/api/shifts', authMiddleware, async (req, res) => {
  const database = await getDb();
  const { employeeId, start, end } = req.query;
  const filter = {};
  if (employeeId) filter.employeeId = employeeId;
  if (start || end) {
    filter.date = {};
    if (start) filter.date.$gte = start;
    if (end) filter.date.$lte = end;
  }
  const shifts = await database.collection('shifts').find(filter).sort({ date: 1 }).toArray();
  res.json(shifts);
});

app.post('/api/shifts', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const database = await getDb();
  const { employee, role, startTime, endTime, date, employeeId } = req.body || {};
  const durationHours = calculateDurationHours(startTime, endTime);
  if (!employee || !role || !startTime || !endTime || !date || durationHours <= 0) {
    return res.status(400).json({ message: 'Missing or invalid shift fields.' });
  }
  const doc = {
    employee,
    employeeId,
    role,
    startTime,
    endTime,
    date,
    durationHours,
    createdAt: new Date(),
  };
  const result = await database.collection('shifts').insertOne(doc);
  res.status(201).json({ _id: result.insertedId, ...doc });
});

app.delete('/api/shifts/:id', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const database = await getDb();
  const result = await database.collection('shifts').deleteOne({ _id: new ObjectId(req.params.id) });
  if (!result.deletedCount) return res.status(404).json({ message: 'Shift not found' });
  res.json({ deleted: true });
});

// ── TIPS ───────────────────────────────────────────────────

app.get('/api/tips', authMiddleware, async (req, res) => {
  const database = await getDb();
  const { date } = req.query;
  const filter = date ? { date } : {};
  const tips = await database.collection('tips').find(filter).sort({ createdAt: -1 }).toArray();
  res.json(tips);
});

app.post('/api/tips', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const { amount, date, notes } = req.body || {};
  if (!amount || !date) return res.status(400).json({ message: 'Amount and date required' });
  const database = await getDb();
  const doc = { amount: Number(amount), date, notes, createdAt: new Date() };
  const result = await database.collection('tips').insertOne(doc);

  await logAction(database, { actor: req.user.name, action: 'add_tip', target: date, details: `$${Number(amount).toFixed(2)} added to tip pool` });

  res.status(201).json({ _id: result.insertedId, ...doc });
});

// ── PUNCHES ────────────────────────────────────────────────

const findLatestPunch = async (database, employeeId) =>
  database.collection('punches').findOne({ employeeId, clockOut: null }, { sort: { clockIn: -1 } });

app.get('/api/punches', authMiddleware, async (req, res) => {
  const database = await getDb();
  const filter = {};
  if (req.query.employeeId) filter.employeeId = req.query.employeeId;
  const punches = await database.collection('punches').find(filter).sort({ clockIn: 1 }).toArray();
  res.json(punches);
});

app.post('/api/punches/clock-in', authMiddleware, async (req, res) => {
  const { employeeId, time } = req.body || {};
  if (!employeeId) return res.status(400).json({ message: 'employeeId required' });
  const database = await getDb();
  const employee = await database.collection('employees').findOne({ _id: new ObjectId(employeeId) });
  const clockIn = time ? new Date(time) : new Date();
  const doc = {
    employeeId,
    employeeName: employee?.name || 'Unknown',
    clockIn,
    clockOut: null,
    breaks: [],
    createdAt: new Date(),
  };
  const result = await database.collection('punches').insertOne(doc);
  res.status(201).json({ _id: result.insertedId, ...doc });
});

app.post('/api/punches/clock-out', authMiddleware, async (req, res) => {
  const { employeeId } = req.body || {};
  const database = await getDb();
  const punch = await findLatestPunch(database, employeeId);
  if (!punch) return res.status(404).json({ message: 'No open punch' });
  await database
    .collection('punches')
    .updateOne({ _id: punch._id }, { $set: { clockOut: new Date() } });
  res.json({ updated: true });
});

app.post('/api/punches/break-start', authMiddleware, async (req, res) => {
  const { employeeId } = req.body || {};
  const database = await getDb();
  const punch = await findLatestPunch(database, employeeId);
  if (!punch) return res.status(404).json({ message: 'No open punch' });
  await database
    .collection('punches')
    .updateOne(
      { _id: punch._id },
      { $push: { breaks: { start: new Date() } } }
    );
  res.json({ updated: true });
});

app.post('/api/punches/break-end', authMiddleware, async (req, res) => {
  const { employeeId } = req.body || {};
  const database = await getDb();
  const punch = await findLatestPunch(database, employeeId);
  if (!punch) return res.status(404).json({ message: 'No open punch' });
  const lastBreak = punch.breaks[punch.breaks.length - 1];
  if (!lastBreak || lastBreak.end) return res.status(400).json({ message: 'No active break' });
  await database.collection('punches').updateOne(
    { _id: punch._id, 'breaks.start': lastBreak.start },
    { $set: { 'breaks.$.end': new Date() } }
  );
  res.json({ updated: true });
});

// ── REQUESTS (swap/leave) ──────────────────────────────────

app.get('/api/requests', authMiddleware, async (req, res) => {
  const database = await getDb();
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const requests = await database
    .collection('requests')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  res.json(requests);
});

app.post('/api/requests', authMiddleware, async (req, res) => {
  const { employee, employeeId, shift, role, reason, type = 'swap' } = req.body || {};
  if (!employee || !shift || !role || !reason) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const database = await getDb();
  const doc = {
    employee,
    employeeId: employeeId || null,
    shift,
    role,
    reason,
    type,
    status: 'pending',
    managerNote: '',
    createdAt: new Date(),
  };
  const result = await database.collection('requests').insertOne(doc);
  res.status(201).json({ _id: result.insertedId, ...doc });
});

app.patch('/api/requests/:id', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const { status, managerNote } = req.body || {};
  if (!['approved', 'declined', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const database = await getDb();
    const update = { status };
    if (managerNote !== undefined) update.managerNote = managerNote;
    await database
      .collection('requests')
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });

    await logAction(database, { actor: req.user.name, action: `request_${status}`, target: req.params.id, details: managerNote || '' });

    res.json({ updated: true });
  } catch (err) {
    res.status(400).json({ message: 'Invalid request id' });
  }
});

// ── AUDIT LOG ──────────────────────────────────────────────

app.get('/api/audit-log', authMiddleware, requireRole('admin'), async (req, res) => {
  const database = await getDb();
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const logs = await database
    .collection('audit_log')
    .find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  res.json(logs);
});

// ── SETTINGS ───────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  businessName: 'Shiftora Restaurant',
  businessHoursOpen: '09:00',
  businessHoursClose: '23:00',
  tipDistribution: 'proportional',
  overtimeThreshold: 40,
  breakDurationMinutes: 30,
  payrollCycle: 'biweekly',
};

app.get('/api/settings', authMiddleware, async (_req, res) => {
  const database = await getDb();
  const rows = await database.collection('settings').find().toArray();
  const merged = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    merged[row.key] = row.value;
  }
  res.json(merged);
});

app.patch('/api/settings', authMiddleware, requireRole('admin'), async (req, res) => {
  const database = await getDb();
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  for (const [key, value] of Object.entries(updates)) {
    await database.collection('settings').updateOne(
      { key },
      { $set: { key, value, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  await logAction(database, { actor: req.user.name, action: 'update_settings', target: 'system', details: `Updated: ${Object.keys(updates).join(', ')}` });

  res.json({ updated: true });
});

// ── NOTIFICATIONS ──────────────────────────────────────────

app.get('/api/notifications', authMiddleware, async (req, res) => {
  const database = await getDb();
  const punches = await database.collection('punches').find({ clockOut: null }).toArray();
  const employees = await database.collection('employees').find().toArray();
  const requests = await database.collection('requests').find({ status: 'pending' }).toArray();

  const notifications = [];

  // Overtime alerts (employees with >8hrs active today)
  for (const p of punches) {
    const hoursActive = (Date.now() - new Date(p.clockIn).getTime()) / 3600000;
    if (hoursActive > 8) {
      notifications.push({
        type: 'overtime',
        severity: 'warning',
        message: `${p.employeeName} has been clocked in for ${Math.floor(hoursActive)}h — possible overtime`,
        timestamp: p.clockIn,
      });
    }
  }

  // Active break too long (>45 min)
  for (const p of punches) {
    const lastBreak = p.breaks?.[p.breaks.length - 1];
    if (lastBreak && !lastBreak.end) {
      const breakMinutes = (Date.now() - new Date(lastBreak.start).getTime()) / 60000;
      if (breakMinutes > 45) {
        notifications.push({
          type: 'long_break',
          severity: 'info',
          message: `${p.employeeName} has been on break for ${Math.floor(breakMinutes)} minutes`,
          timestamp: lastBreak.start,
        });
      }
    }
  }

  // Pending requests
  if (requests.length > 0) {
    notifications.push({
      type: 'pending_requests',
      severity: 'info',
      message: `${requests.length} pending swap/leave request${requests.length > 1 ? 's' : ''} to review`,
      timestamp: new Date().toISOString(),
    });
  }

  res.json(notifications);
});

// ── REPORTS ────────────────────────────────────────────────

const minutesWorked = (punch) => {
  if (!punch.clockIn) return 0;
  const end = punch.clockOut ? new Date(punch.clockOut) : new Date();
  const breaksMinutes = (punch.breaks || []).reduce((sum, brk) => {
    if (!brk.start || !brk.end) return sum;
    return sum + (new Date(brk.end) - new Date(brk.start)) / 60000;
  }, 0);
  return Math.max(0, (end - new Date(punch.clockIn)) / 60000 - breaksMinutes);
};

app.get('/api/reports/daily', authMiddleware, async (req, res) => {
  const dateParam = req.query.date;
  if (!dateParam) return res.status(400).json({ message: 'date required (YYYY-MM-DD)' });
  const database = await getDb();
  const report = await buildDailyReport(database, dateParam);
  res.json(report);
});

const buildDailyReport = async (database, dateParam) => {
  const dayStart = new Date(`${dateParam}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [punches, tips, employees] = await Promise.all([
    database
      .collection('punches')
      .find({ clockIn: { $gte: dayStart, $lt: dayEnd } })
      .toArray(),
    database.collection('tips').find({ date: dateParam }).toArray(),
    database.collection('employees').find().toArray(),
  ]);

  const perEmployee = {};
  punches.forEach((p) => {
    const minutes = minutesWorked(p);
    const employee = employees.find((e) => e._id?.toString() === p.employeeId)
      || employees.find((e) => e.userId?.toString() === p.employeeId) || {};
    if (!perEmployee[p.employeeId]) {
      perEmployee[p.employeeId] = {
        employeeId: p.employeeId,
        name: p.employeeName,
        role: employee.role || 'Employee',
        hourlyRate: employee.hourlyRate || 16,
        minutesWorked: 0,
      };
    }
    perEmployee[p.employeeId].minutesWorked += minutes;
  });

  const tipsTotal = tips.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalMinutesAll = Object.values(perEmployee).reduce((s, e) => s + e.minutesWorked, 0);
  const employeesArr = Object.values(perEmployee).map((emp) => {
    const hours = Math.round((emp.minutesWorked / 60) * 100) / 100;
    const wages = Math.round(hours * emp.hourlyRate * 100) / 100;
    const tipShare = totalMinutesAll > 0 ? (emp.minutesWorked / totalMinutesAll) * tipsTotal : 0;
    return {
      name: emp.name,
      role: emp.role,
      hours,
      rate: emp.hourlyRate,
      wages,
      tips: Math.round(tipShare * 100) / 100,
    };
  });

  const totalWages = employeesArr.reduce((sum, e) => sum + e.wages, 0);
  return {
    date: dateParam,
    totalWages,
    totalTips: tipsTotal,
    totalHours: employeesArr.reduce((sum, e) => sum + e.hours, 0),
    employees: employeesArr,
  };
};

app.get('/api/reports/overview', authMiddleware, async (_req, res) => {
  const database = await getDb();
  const today = new Date();
  const dayString = today.toISOString().split('T')[0];
  const dayReport = await buildDailyReport(database, dayString);
  const weekReport = await buildWeekly(database, today);
  res.json({ daily: dayReport, weekly: weekReport });
});

async function buildWeekly(database, today) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  let totalWages = 0;
  let totalTips = 0;
  let totalRevenue = 0;
  let hoursWorked = 0;
  const reports = await Promise.all(dates.map((dateStr) => buildDailyReport(database, dateStr)));
  for (const daily of reports) {
    totalWages += daily?.totalWages || 0;
    totalTips += daily?.totalTips || 0;
    hoursWorked += daily?.totalHours || 0;
  }
  return {
    totalWages,
    totalTips,
    totalRevenue,
    hoursWorked,
    laborCostPercentage: 0,
  };
}

app.get('/api/reports/employee/weekly', authMiddleware, async (req, res) => {
  const { employeeId, periods = 1, reference } = req.query || {};
  if (!employeeId) return res.status(400).json({ message: 'employeeId required' });
  const database = await getDb();

  const buildWeek = async (weekStartDate) => {
    const weekStart = startOfWeekMonday(weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [punches, tips, employees] = await Promise.all([
      database
        .collection('punches')
        .find({ clockIn: { $gte: weekStart, $lt: weekEnd } })
        .toArray(),
      database
        .collection('tips')
        .find({
          date: {
            $gte: weekStart.toISOString().split('T')[0],
            $lt: weekEnd.toISOString().split('T')[0],
          },
        })
        .toArray(),
      database.collection('employees').find().toArray(),
    ]);

    const employeeDoc =
      employees.find((e) => e._id?.toString() === employeeId) ||
      employees.find((e) => e.userId?.toString && e.userId.toString() === employeeId) ||
      employees.find((e) => e.email === req.query.email);

    const hourlyRate = employeeDoc?.hourlyRate || 16;
    const name = employeeDoc?.name || 'Employee';
    const role = employeeDoc?.role || 'Employee';

    const dayMap = {};
    punches.forEach((p) => {
      const dateStr = new Date(p.clockIn).toISOString().split('T')[0];
      if (!dayMap[dateStr]) dayMap[dateStr] = [];
      dayMap[dateStr].push(p);
    });

    let totalMinutes = 0;
    let totalTips = 0;
    const days = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const dateStr = day.toISOString().split('T')[0];

      const punchesForDay = dayMap[dateStr] || [];
      const minutesForEmployee = punchesForDay
        .filter((p) => p.employeeId === employeeId)
        .reduce((sum, p) => sum + minutesWorked(p), 0);

      const participants = new Set(punchesForDay.map((p) => p.employeeId));
      const tipsForDay = tips
        .filter((t) => t.date === dateStr)
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const tipShare = participants.size ? tipsForDay / participants.size : 0;

      totalMinutes += minutesForEmployee;
      totalTips += minutesForEmployee > 0 ? tipShare : 0;

      days.push({
        date: dateStr,
        hours: Math.round((minutesForEmployee / 60) * 100) / 100,
        tips: Math.round(tipShare * 100) / 100,
      });
    }

    const hoursWorked = Math.round((totalMinutes / 60) * 100) / 100;
    const wages = Math.round(hoursWorked * hourlyRate * 100) / 100;

    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: new Date(weekEnd.getTime() - 1).toISOString().split('T')[0],
      employeeId,
      name,
      role,
      hoursWorked,
      wages,
      tips: Math.round(totalTips * 100) / 100,
      hourlyRate,
      days,
    };
  };

  const periodsCount = Math.max(1, Math.min(4, Number(periods)));
  const refDate = reference ? new Date(reference) : new Date();
  const weeks = [];
  for (let i = 0; i < periodsCount; i++) {
    const weekStart = new Date(refDate);
    weekStart.setDate(refDate.getDate() - i * 7);
    weeks.push(await buildWeek(weekStart));
  }

  res.json({ weeks });
});

// ── SEED ───────────────────────────────────────────────────

async function seed(database) {
  const usersCol = database.collection('users');
  const employeesCol = database.collection('employees');

  if (!(await usersCol.findOne({ email: 'admin@shiftora.test' }))) {
    const pw = await bcrypt.hash('password123', 10);
    await usersCol.insertOne({
      name: 'Demo Admin',
      email: 'admin@shiftora.test',
      passwordHash: pw,
      role: 'admin',
    });
    console.log('Seeded demo admin account');
  }

  if (!(await usersCol.findOne({ email: 'manager@shiftora.test' }))) {
    const pw = await bcrypt.hash('password123', 10);
    const manager = await usersCol.insertOne({
      name: 'Demo Manager',
      email: 'manager@shiftora.test',
      passwordHash: pw,
      role: 'manager',
    });
    await employeesCol.insertOne({
      userId: manager.insertedId,
      name: 'Demo Manager',
      email: 'manager@shiftora.test',
      role: 'Manager',
      department: 'Management',
      level: 'Manager',
      hourlyRate: 28,
      status: 'active',
      joinDate: new Date().toISOString(),
    });
    console.log('Seeded demo manager account');
  }

  if (!(await usersCol.findOne({ email: 'employee@shiftora.test' }))) {
    const pw = await bcrypt.hash('password123', 10);
    const emp = await usersCol.insertOne({
      name: 'Demo Employee',
      email: 'employee@shiftora.test',
      passwordHash: pw,
      role: 'employee',
    });
    await employeesCol.insertOne({
      userId: emp.insertedId,
      name: 'Demo Employee',
      email: 'employee@shiftora.test',
      role: 'Server',
      department: 'Front of House',
      level: 'Employee',
      hourlyRate: 16,
      status: 'active',
      joinDate: new Date().toISOString(),
    });
    console.log('Seeded demo employee account');
  }

  // Seed default settings
  const settingsCol = database.collection('settings');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await settingsCol.findOne({ key });
    if (!existing) {
      await settingsCol.insertOne({ key, value, updatedAt: new Date() });
    }
  }
}

// ── START ──────────────────────────────────────────────────

async function start() {
  try {
    await getDb();
    app.listen(PORT, () => {
      console.log(`Shiftora API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed.');
  }
  process.exit(0);
});
