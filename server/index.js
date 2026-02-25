const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shiftora';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-shiftora-secret';

app.use(cors());
app.use(express.json());

let client;
let db;
let seeded = false;

const MINUTES_IN_DAY = 24 * 60;

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
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();
  console.log(`Connected to MongoDB at ${MONGO_URI}`);
  if (!seeded) {
    await seed(db);
    seeded = true;
  }
  return db;
}

const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: '12h',
  });

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

app.get('/api/health', async (_req, res) => {
  try {
    await getDb();
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// AUTH
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'employee', hourlyRate = 16 } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
  const database = await getDb();
  const existing = await database.collection('users').findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const userDoc = { name, email, passwordHash, role };
  const userResult = await database.collection('users').insertOne(userDoc);

  await database.collection('employees').insertOne({
    userId: userResult.insertedId,
    name,
    email,
    role,
    department: 'Front of House',
    level: role === 'manager' ? 'Manager' : 'Employee',
    hourlyRate,
    status: 'active',
    joinDate: new Date().toISOString(),
  });

  const token = signToken({ ...userDoc, _id: userResult.insertedId });
  res.json({ id: userResult.insertedId, name, email, role, token });
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
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role, token });
});

// EMPLOYEES CRUD
app.get('/api/employees', authMiddleware, async (_req, res) => {
  const database = await getDb();
  const employees = await database.collection('employees').find().toArray();
  res.json(employees);
});

app.post('/api/employees', authMiddleware, async (req, res) => {
  const employee = req.body || {};
  if (!employee.name) return res.status(400).json({ message: 'Name required' });
  const database = await getDb();
  const result = await database.collection('employees').insertOne({
    ...employee,
    status: employee.status || 'active',
    joinDate: employee.joinDate || new Date().toISOString(),
  });
  res.status(201).json({ _id: result.insertedId, ...employee });
});

app.patch('/api/employees/:id', authMiddleware, async (req, res) => {
  const database = await getDb();
  await database
    .collection('employees')
    .updateOne({ _id: new ObjectId(req.params.id) }, { $set: req.body });
  res.json({ updated: true });
});

app.delete('/api/employees/:id', authMiddleware, async (req, res) => {
  const database = await getDb();
  await database.collection('employees').deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ deleted: true });
});

// SHIFTS
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

app.post('/api/shifts', authMiddleware, async (req, res) => {
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

app.delete('/api/shifts/:id', authMiddleware, async (req, res) => {
  const database = await getDb();
  const result = await database.collection('shifts').deleteOne({ _id: new ObjectId(req.params.id) });
  if (!result.deletedCount) return res.status(404).json({ message: 'Shift not found' });
  res.json({ deleted: true });
});

// TIPS
app.get('/api/tips', authMiddleware, async (req, res) => {
  const database = await getDb();
  const { date } = req.query;
  const filter = date ? { date } : {};
  const tips = await database.collection('tips').find(filter).sort({ createdAt: -1 }).toArray();
  res.json(tips);
});

app.post('/api/tips', authMiddleware, async (req, res) => {
  const { amount, date, notes } = req.body || {};
  if (!amount || !date) return res.status(400).json({ message: 'Amount and date required' });
  const database = await getDb();
  const doc = { amount: Number(amount), date, notes, createdAt: new Date() };
  const result = await database.collection('tips').insertOne(doc);
  res.status(201).json({ _id: result.insertedId, ...doc });
});

// PUNCHES
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

// REPORTS
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
    const employee = employees.find((e) => e._id.toString() === p.employeeId) || {};
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
  const employeesArr = Object.values(perEmployee).map((emp) => {
    const hours = Math.round((emp.minutesWorked / 60) * 100) / 100;
    const wages = Math.round(hours * emp.hourlyRate * 100) / 100;
    return {
      name: emp.name,
      role: emp.role,
      hours,
      rate: emp.hourlyRate,
      wages,
      tips: 0, // distributed below
    };
  });

  // Simple equal tip split
  const splitTips = employeesArr.length ? tipsTotal / employeesArr.length : 0;
  employeesArr.forEach((emp) => (emp.tips = Math.round(splitTips * 100) / 100));

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
  for (const dateStr of dates) {
    const daily = await buildDailyReport(database, dateStr);
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

// Seed with a manager/admin for quick use
async function seed(database) {
  const usersCol = database.collection('users');
  const employeesCol = database.collection('employees');
  const existing = await usersCol.findOne({ email: 'manager@shiftora.test' });
  if (!existing) {
    const passwordHash = await bcrypt.hash('password123', 10);
    const manager = await usersCol.insertOne({
      name: 'Demo Manager',
      email: 'manager@shiftora.test',
      passwordHash,
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
  }
}

app.listen(PORT, () => {
  console.log(`Shiftora API listening on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed.');
  }
  process.exit(0);
});
