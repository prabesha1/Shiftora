import { Users, TrendingUp, DollarSign, Building2, Shield, Settings, ChevronRight, Trash2, Crown, ArrowUpCircle, ArrowDownCircle, Plus, Calendar, Clock, BarChart3, FileText, UserX, LogIn, Coffee, Activity, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { formatLongDate, toISODate } from '../utils/time';
import { api } from '../api/client';
import { DateTimePanel } from './datetime-panel';

type Props = {
  onNavigate: (page: string) => void;
  onLogout: () => void;
  user: { id: string; name: string; email?: string; role: string; token: string };
};

type Employee = {
  _id: string;
  name: string;
  role: string;
  department: string;
  level: string;
  email: string;
  phone?: string;
  hourlyRate: number;
  status?: string;
  joinDate?: string;
  userId?: string;
};

type Punch = {
  _id: string;
  employeeId: string;
  employeeName: string;
  clockIn: string;
  clockOut?: string;
  breaks: { start: string; end?: string }[];
};

export function AdminDashboard({ onNavigate, onLogout, user }: Props) {
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date();
  const todayIso = toISODate(today);
  const todayLabel = formatLongDate(today);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [tips, setTips] = useState<{ _id: string; amount: number; date: string; notes?: string }[]>([]);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const [showEmployeeManagement, setShowEmployeeManagement] = useState(false);
  const [showFinancialReport, setShowFinancialReport] = useState(false);
  const [showAllPunchesModal, setShowAllPunchesModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', password: '', role: 'Server', department: 'Front of House', hourlyRate: 16 });
  const [adminProfile, setAdminProfile] = useState({ name: '', dob: '', address: '', phone: '' });
  const [adminProfileEditing, setAdminProfileEditing] = useState(false);
  const [adminPasswordForm, setAdminPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [adminProfileMessage, setAdminProfileMessage] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState('');
  const [tipNotes, setTipNotes] = useState('');

  const getId = (emp: Employee) => emp._id || '';

  const liveEmployeeStatus = employees.map((emp) => {
    const openPunch = punches.find((p) => (p.employeeId === emp._id || p.employeeId === String((emp as any).userId ?? '')) && !p.clockOut);
    const lastBreak = openPunch?.breaks?.[openPunch.breaks.length - 1];
    const durationMinutes = openPunch ? Math.max(0, (Date.now() - new Date(openPunch.clockIn).getTime()) / 60000) : 0;
    const status = openPunch ? (lastBreak && !lastBreak.end ? 'break' : 'working') : 'punched_out';
    return {
      ...emp,
      status,
      punchInTime: openPunch ? new Date(openPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      breakStart: lastBreak?.start ? new Date(lastBreak.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      avatar: emp.name.split(' ').map((n) => n[0]).join(''),
      currentDuration: openPunch ? `${Math.floor(durationMinutes / 60)}h ${Math.floor(durationMinutes % 60)}m` : '',
    };
  });

  const groupedByDepartment = useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    employees.forEach(e => {
      const dept = e.department || 'Other';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(e);
    });
    return groups;
  }, [employees]);

  const deptColors: Record<string, { bg: string; border: string; icon: string; gradient: string }> = {
    'Front of House': { bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb', gradient: 'linear-gradient(135deg, #eff6ff, #dbeafe)' },
    'Kitchen': { bg: '#fef2f2', border: '#fca5a5', icon: '#dc2626', gradient: 'linear-gradient(135deg, #fef2f2, #fee2e2)' },
    'Bar': { bg: '#f5f3ff', border: '#c4b5fd', icon: '#7c3aed', gradient: 'linear-gradient(135deg, #f5f3ff, #ede9fe)' },
    'Management': { bg: '#fffbeb', border: '#fcd34d', icon: '#d97706', gradient: 'linear-gradient(135deg, #fffbeb, #fef3c7)' },
  };
  const defaultDeptColor = { bg: '#f9fafb', border: '#d1d5db', icon: '#6b7280', gradient: 'linear-gradient(135deg, #f9fafb, #f3f4f6)' };

  const groupedByLevel = {
    Manager: employees.filter(e => e.level === 'Manager'),
    Employee: employees.filter(e => e.level !== 'Manager'),
  };

  const workingCount = liveEmployeeStatus.filter(e => e.status === 'working').length;
  const breakCount = liveEmployeeStatus.filter(e => e.status === 'break').length;
  const offCount = liveEmployeeStatus.filter(e => e.status === 'punched_out').length;

  useEffect(() => {
    if (showAdminProfile) {
      api.getProfile(user.token).then((p) => setAdminProfile({ name: p.name || '', dob: p.dob || '', address: p.address || '', phone: p.phone || '' })).catch(() => {});
    }
  }, [user.token, showAdminProfile]);

  useEffect(() => {
    const load = async () => {
      try {
        const [empList, punchList, tipList, overview] = await Promise.all([
          api.getEmployees(user.token),
          api.getPunches({}, user.token),
          api.getTips(todayIso, user.token),
          api.getOverviewReport(user.token),
        ]);
        setEmployees(empList as Employee[]);
        setPunches(punchList as Punch[]);
        setTips(tipList as any[]);
        if (overview?.daily) setDailyReport(overview.daily);
        if (overview?.weekly) setWeeklyReport(overview.weekly);
      } catch (err: any) {
        setConfirmationMessage(err.message || 'Failed to load data.');
      }
    };
    load();
    const interval = setInterval(async () => {
      try {
        const [punchList, tipList, overview] = await Promise.all([
          api.getPunches({}, user.token),
          api.getTips(todayIso, user.token),
          api.getOverviewReport(user.token),
        ]);
        setPunches(punchList as Punch[]);
        setTips(tipList as any[]);
        if (overview?.daily) setDailyReport(overview.daily);
        if (overview?.weekly) setWeeklyReport(overview.weekly);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [user.token, todayIso]);

  const handlePromote = async (employee: Employee) => {
    const isManager = employee.level === 'Manager';
    try {
      await api.updateEmployee(getId(employee), { level: isManager ? 'Employee' : 'Manager', role: isManager ? 'Server' : 'Manager' }, user.token);
      setEmployees(prev => prev.map(e => getId(e) === getId(employee) ? { ...e, level: isManager ? 'Employee' : 'Manager', role: isManager ? 'Server' : 'Manager' } : e));
      setConfirmationMessage(`${employee.name} has been ${isManager ? 'demoted to Employee' : 'promoted to Manager'}!`);
    } catch (err: any) { setConfirmationMessage(err.message || 'Failed to update role.'); }
    setTimeout(() => setConfirmationMessage(null), 3000);
    setShowPromoteModal(false); setSelectedEmployee(null);
  };

  const handleRemoveEmployee = (employee: Employee) => {
    api.deleteEmployee(getId(employee), user.token)
      .then(() => { setEmployees(prev => prev.filter(e => getId(e) !== getId(employee))); setConfirmationMessage(`${employee.name} has been removed.`); })
      .catch((err: any) => setConfirmationMessage(err.message));
    setTimeout(() => setConfirmationMessage(null), 3000);
    setShowRemoveModal(false); setSelectedEmployee(null);
  };

  const handleAddEmployee = async () => {
    const { name, email, password, role, department, hourlyRate } = newEmployee;
    if (!name || !email) { setConfirmationMessage('Name and email are required.'); setTimeout(() => setConfirmationMessage(null), 3000); return; }
    if (!password || password.length < 6) { setConfirmationMessage('Password must be at least 6 characters.'); setTimeout(() => setConfirmationMessage(null), 3000); return; }
    try {
      const created = await api.createEmployee({ name, email, password, role, department, level: role === 'Manager' ? 'Manager' : 'Employee', hourlyRate: Number(hourlyRate), status: 'active' }, user.token);
      setEmployees(prev => [...prev, created as Employee]);
      setNewEmployee({ name: '', email: '', password: '', role: 'Server', department: 'Front of House', hourlyRate: 16 });
      setShowAddEmployeeModal(false);
      setConfirmationMessage(`${name} has been added!`);
    } catch (err: any) { setConfirmationMessage(err.message || 'Failed to add employee.'); }
    setTimeout(() => setConfirmationMessage(null), 3000);
  };

  const handleAddTip = async () => {
    const amount = parseFloat(tipAmount);
    if (Number.isNaN(amount) || amount <= 0) { setConfirmationMessage('Enter a valid tip amount.'); return; }
    try {
      const created = await api.createTip({ amount, date: todayIso, notes: tipNotes }, user.token);
      setTips([...tips, created]); setTipAmount(''); setTipNotes('');
      setConfirmationMessage('Tips pool updated.');
    } catch (err: any) { setConfirmationMessage(err.message); }
    setTimeout(() => setConfirmationMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Premium Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderColor: '#e2e8f0' }}>
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="text-2xl tracking-tight">
              <span className="font-bold text-[#2563EB]">Shift</span><span className="font-light text-gray-900">ora</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white tracking-wide uppercase" style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}>
              <Crown className="w-3.5 h-3.5" />
              Admin
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button className="text-gray-900 font-semibold text-sm">Dashboard</button>
            <button onClick={() => onNavigate('wages')} className="text-gray-500 hover:text-gray-900 transition-colors text-sm">Wages & Tips</button>
          </div>

          <div className="flex items-center gap-4">
            <DateTimePanel />
            <button
              onClick={() => setShowAdminProfile(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white cursor-pointer hover:shadow-lg hover:scale-105 transition-all shadow-md"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
            >
              {(user.name || 'A')[0].toUpperCase()}
            </button>
            <Button variant="ghost" onClick={onLogout} className="hidden sm:inline-flex text-sm">Log out</Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-10">
        {/* Hero Header */}
        <div className="rounded-3xl p-8 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #f59e0b, transparent)', transform: 'translate(30%, -30%)' }} />
          <div className="relative z-10">
            <p className="text-amber-400 text-sm font-medium tracking-wide uppercase mb-2">{todayLabel}</p>
            <h1 className="text-4xl font-bold text-white mb-2">{greeting}, {user.name || 'Admin'}</h1>
            <p className="text-slate-400 text-lg">Full oversight and control of your restaurant operations.</p>
          </div>
          <div className="relative z-10 mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl p-5 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-3xl font-bold text-white mb-1">{employees.length}</div>
              <div className="text-sm text-slate-400">Total Staff</div>
            </div>
            <div className="rounded-2xl p-5 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-3xl font-bold text-emerald-400 mb-1">${dailyReport?.totalWages.toFixed(0) || '0'}</div>
              <div className="text-sm text-slate-400">Today Wages</div>
            </div>
            <div className="rounded-2xl p-5 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-3xl font-bold text-purple-400 mb-1">${dailyReport?.totalTips.toFixed(0) || '0'}</div>
              <div className="text-sm text-slate-400">Today Tips</div>
            </div>
            <div className="rounded-2xl p-5 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-3xl font-bold text-amber-400 mb-1">{dailyReport?.totalHours.toFixed(0) || '0'}h</div>
              <div className="text-sm text-slate-400">Hours Logged</div>
            </div>
          </div>
        </div>

        {/* Live Status + Punches */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Live Status */}
          <div className="lg:col-span-3 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Live Status</h2>
                <p className="text-sm text-gray-500 mt-1">Who's on the clock right now</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} /><span className="text-sm font-medium text-gray-700">{workingCount}</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} /><span className="text-sm font-medium text-gray-700">{breakCount}</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-300" /><span className="text-sm font-medium text-gray-700">{offCount}</span></div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {liveEmployeeStatus.map((emp, idx) => (
                <div key={idx} className="rounded-2xl p-5 border transition-all" style={{
                  borderColor: emp.status === 'working' ? '#86efac' : emp.status === 'break' ? '#fcd34d' : '#e5e7eb',
                  backgroundColor: emp.status === 'working' ? '#f0fdf4' : emp.status === 'break' ? '#fffbeb' : '#fafafa',
                }}>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm" style={{
                      background: emp.status === 'working' ? 'linear-gradient(135deg, #22c55e, #15803d)' : emp.status === 'break' ? 'linear-gradient(135deg, #f59e0b, #b45309)' : 'linear-gradient(135deg, #9ca3af, #6b7280)',
                    }}>
                      {emp.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{emp.name}</div>
                      <div className="text-xs text-gray-500">{emp.role}</div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{
                      backgroundColor: emp.status === 'working' ? '#16a34a' : emp.status === 'break' ? '#d97706' : '#9ca3af',
                    }}>
                      {emp.status === 'working' ? 'Working' : emp.status === 'break' ? 'Break' : 'Off'}
                    </span>
                  </div>
                  {emp.status !== 'punched_out' && (
                    <div className="flex items-center justify-between text-xs text-gray-600 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <span>In at {emp.punchInTime}</span>
                      <span className="font-semibold">{emp.currentDuration}</span>
                    </div>
                  )}
                </div>
              ))}
              {employees.length === 0 && <div className="sm:col-span-2 p-8 text-center text-gray-400 rounded-2xl border-2 border-dashed border-gray-200">No employees yet</div>}
            </div>
          </div>

          {/* Right column: Quick Actions + Tips */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-5">
              <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
              <div className="space-y-3">
                <button className="w-full rounded-2xl h-13 inline-flex items-center gap-3 px-5 py-3.5 text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }} onClick={() => setShowAddEmployeeModal(true)}>
                  <Plus className="w-5 h-5" /> Add New Employee
                </button>
                <Button variant="outline" className="w-full justify-start rounded-2xl h-13 px-5 py-3.5" onClick={() => setShowEmployeeManagement(true)}>
                  <Users className="w-5 h-5 mr-3" /> Manage Employees
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-2xl h-13 px-5 py-3.5" onClick={() => setShowFinancialReport(true)}>
                  <FileText className="w-5 h-5 mr-3" /> Financial Reports
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-2xl h-13 px-5 py-3.5" onClick={() => onNavigate('wages')}>
                  <DollarSign className="w-5 h-5 mr-3" /> Wages & Tips Report
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-2xl h-13 px-5 py-3.5" onClick={() => setShowSettingsModal(true)}>
                  <Settings className="w-5 h-5 mr-3" /> System Settings
                </Button>
              </div>
            </div>

            {/* Tips Pool */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-5">
              <h2 className="text-xl font-bold text-gray-900">Tips Pool</h2>
              <p className="text-sm text-gray-500 -mt-3">Add today's tip pool for proportional distribution</p>
              <div className="flex gap-3">
                <Input type="number" min="0" placeholder="$ Amount" value={tipAmount} onChange={e => setTipAmount(e.target.value)} className="rounded-xl" />
                <button className="rounded-xl px-5 py-2 text-sm font-semibold text-white shrink-0" style={{ backgroundColor: '#2563EB' }} onClick={handleAddTip}>Add</button>
              </div>
              <Input placeholder="Notes (optional)" value={tipNotes} onChange={e => setTipNotes(e.target.value)} className="rounded-xl" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{tips.filter(t => t.date === todayIso).length} entries today</span>
                <span className="font-bold text-gray-900">${tips.filter(t => t.date === todayIso).reduce((s, t) => s + Number(t.amount || 0), 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Departments */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Departments</h2>
              <p className="text-sm text-gray-500 mt-1">Team structure from your database</p>
            </div>
            <span className="text-sm font-medium text-gray-500">{Object.keys(groupedByDepartment).length} departments — {employees.length} staff</span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Object.entries(groupedByDepartment).map(([dept, emps]) => {
              const colors = deptColors[dept] || defaultDeptColor;
              const managers = emps.filter(e => e.level === 'Manager');
              return (
                <button
                  key={dept}
                  onClick={() => { setSelectedDepartment(dept); setShowDepartmentModal(true); }}
                  className="rounded-2xl p-6 border-2 text-left transition-all hover:shadow-md hover:scale-[1.02]"
                  style={{ background: colors.gradient, borderColor: colors.border }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: colors.icon + '18' }}>
                    <Building2 className="w-6 h-6" style={{ color: colors.icon }} />
                  </div>
                  <div className="text-lg font-bold text-gray-900 mb-1">{dept}</div>
                  <div className="text-3xl font-black text-gray-900 mb-2">{emps.length}</div>
                  <div className="text-xs text-gray-600">
                    {managers.length > 0 ? `${managers.map(m => m.name.split(' ')[0]).join(', ')} — Mgr` : 'No manager assigned'}
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-semibold" style={{ color: colors.icon }}>
                    <Eye className="w-3.5 h-3.5" /> View team
                  </div>
                </button>
              );
            })}
            {Object.keys(groupedByDepartment).length === 0 && (
              <div className="sm:col-span-2 lg:col-span-4 p-8 text-center text-gray-400 rounded-2xl border-2 border-dashed border-gray-200">No departments yet — add employees to populate.</div>
            )}
          </div>
        </div>

        {/* Time Punches */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Recent Punches</h2>
              <p className="text-sm text-gray-500 mt-1">Latest punch in/out records</p>
            </div>
            <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>{punches.length} total</span>
          </div>

          <div className="space-y-3">
            {[...punches].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()).slice(0, 4).map((punch) => {
              const pIn = new Date(punch.clockIn);
              const pOut = punch.clockOut ? new Date(punch.clockOut) : null;
              const dur = pOut ? Math.round((pOut.getTime() - pIn.getTime()) / 60000) : null;
              const isActive = !pOut;
              return (
                <div key={punch._id} className="rounded-2xl border p-5 flex flex-wrap items-center gap-5 transition-colors" style={{ borderColor: isActive ? '#86efac' : '#e5e7eb', backgroundColor: isActive ? '#f0fdf4' : '#fafafa' }}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: isActive ? '#16a34a' : '#3b82f6' }}>
                      {punch.employeeName?.slice(0, 2).toUpperCase() || '—'}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{punch.employeeName}</div>
                      <div className="text-xs text-gray-500">{pIn.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-x-8 gap-y-1 text-sm">
                    <div><span className="text-gray-500">In: </span><span className="font-bold tabular-nums" style={{ color: '#059669' }}>{pIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>
                    <div><span className="text-gray-500">Out: </span><span className={`font-bold tabular-nums ${pOut ? 'text-red-600' : 'text-amber-600'}`}>{pOut ? pOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span></div>
                    {dur != null && <div><span className="text-gray-500">Dur: </span><span className="font-bold">{Math.floor(dur / 60)}h {dur % 60}m</span></div>}
                  </div>
                  {isActive && <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#16a34a' }}>Active</span>}
                </div>
              );
            })}
          </div>
          {punches.length === 0 && <div className="p-10 text-center text-gray-400 rounded-2xl border-2 border-dashed border-gray-200">No punch records yet</div>}
          {punches.length > 4 && (
            <button onClick={() => setShowAllPunchesModal(true)} className="w-full py-4 rounded-2xl border-2 border-dashed border-blue-200 text-[#2563EB] font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm">
              See all {punches.length} records <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Financial Analytics */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Financial Analytics</h2>
              <p className="text-sm text-gray-500 mt-1">Daily and weekly performance at a glance</p>
            </div>
            <button onClick={() => setShowFinancialReport(true)} className="text-sm font-semibold text-[#2563EB] hover:text-[#1d4ed8] flex items-center gap-1">Full report <ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { label: 'Today Wages', value: `$${dailyReport?.totalWages.toFixed(2) || '0.00'}`, sub: `${dailyReport?.totalHours.toFixed(1) || '0'} hours`, color: '#059669', bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)' },
              { label: 'Today Tips', value: `$${dailyReport?.totalTips.toFixed(2) || '0.00'}`, sub: 'Proportional split', color: '#7c3aed', bg: 'linear-gradient(135deg, #faf5ff, #ede9fe)' },
              { label: 'Week Wages', value: `$${weeklyReport?.totalWages.toFixed(2) || '0.00'}`, sub: `${weeklyReport?.hoursWorked.toFixed(1) || '0'} hours`, color: '#2563eb', bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)' },
              { label: 'Week Total', value: `$${((weeklyReport?.totalWages || 0) + (weeklyReport?.totalTips || 0)).toFixed(2)}`, sub: 'Wages + tips', color: '#b45309', bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl p-6 border" style={{ background: stat.bg, borderColor: stat.color + '30' }}>
                <div className="text-sm text-gray-600 mb-2">{stat.label}</div>
                <div className="text-3xl font-black" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-xs text-gray-500 mt-2">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Employee Breakdown */}
          {dailyReport?.employees?.length > 0 && (
            <div className="pt-6" style={{ borderTop: '1px solid #f1f5f9' }}>
              <h3 className="font-semibold text-gray-900 mb-4">Today's Employee Breakdown</h3>
              <div className="space-y-2">
                {dailyReport.employees.map((emp: any, idx: number) => (
                  <div key={idx} className="rounded-xl p-4 bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs" style={{ background: 'linear-gradient(135deg, #60a5fa, #2563eb)' }}>{emp.name?.split(' ').map((n: string) => n[0]).join('') || '?'}</div>
                      <div><div className="font-semibold text-sm">{emp.name}</div><div className="text-xs text-gray-500">{emp.role} — {emp.hours}h @ ${emp.rate}/hr</div></div>
                    </div>
                    <div className="text-right"><div className="font-bold text-sm">${(emp.wages + emp.tips).toFixed(2)}</div><div className="text-xs text-gray-400">${emp.wages.toFixed(2)} + ${emp.tips.toFixed(2)} tips</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payroll Summary Card */}
        <div className="rounded-3xl p-8 border-2 border-amber-200 space-y-4" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#f59e0b' }}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-900">Payroll Summary</h2>
              <p className="text-sm text-amber-700">Weekly payroll overview for all staff</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            <div className="rounded-2xl p-5 bg-white/70 border border-amber-200">
              <div className="text-sm text-amber-800 mb-1">Total Payroll</div>
              <div className="text-3xl font-black text-amber-900">${((weeklyReport?.totalWages || 0) + (weeklyReport?.totalTips || 0)).toFixed(2)}</div>
              <div className="text-xs text-amber-700 mt-1">This week</div>
            </div>
            <div className="rounded-2xl p-5 bg-white/70 border border-amber-200">
              <div className="text-sm text-amber-800 mb-1">Avg Per Employee</div>
              <div className="text-3xl font-black text-amber-900">
                ${employees.length > 0 ? (((weeklyReport?.totalWages || 0) + (weeklyReport?.totalTips || 0)) / employees.length).toFixed(2) : '0.00'}
              </div>
              <div className="text-xs text-amber-700 mt-1">{employees.length} staff members</div>
            </div>
            <div className="rounded-2xl p-5 bg-white/70 border border-amber-200">
              <div className="text-sm text-amber-800 mb-1">Avg Hourly Rate</div>
              <div className="text-3xl font-black text-amber-900">
                ${employees.length > 0 ? (employees.reduce((s, e) => s + e.hourlyRate, 0) / employees.length).toFixed(2) : '0.00'}
              </div>
              <div className="text-xs text-amber-700 mt-1">Across all roles</div>
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {confirmationMessage && (
        <div className="fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50 text-white" style={{ backgroundColor: '#22c55e' }}>
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
          <span className="font-medium">{confirmationMessage}</span>
        </div>
      )}

      {/* All Punches Modal */}
      {showAllPunchesModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
          <div className="w-full max-w-4xl mx-4 bg-white rounded-3xl shadow-2xl">
            <div className="sticky top-0 z-10 px-8 py-6 border-b border-gray-200 bg-white rounded-t-3xl flex items-center justify-between">
              <div><h2 className="text-2xl font-bold text-gray-900">All Time Punches</h2><p className="text-sm text-gray-500 mt-1">{punches.length} records — latest first</p></div>
              <button onClick={() => setShowAllPunchesModal(false)} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-3">
              {[...punches].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()).map((punch) => {
                const pIn = new Date(punch.clockIn); const pOut = punch.clockOut ? new Date(punch.clockOut) : null;
                const dur = pOut ? Math.round((pOut.getTime() - pIn.getTime()) / 60000) : null; const isActive = !pOut;
                return (
                  <div key={punch._id} className={`rounded-xl border p-4 ${isActive ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:bg-white'} transition-colors`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${isActive ? 'bg-emerald-600' : 'bg-blue-600'}`}>{punch.employeeName?.slice(0, 2).toUpperCase() || '—'}</div>
                      <div className="flex-1 min-w-0"><div className="font-semibold text-gray-900">{punch.employeeName}</div><div className="text-xs text-gray-500">{pIn.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div></div>
                      {isActive && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white">Active</span>}
                      {dur != null && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">{Math.floor(dur / 60)}h {dur % 60}m</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm pl-[52px]">
                      <div><span className="text-gray-500">In: </span><span className="font-semibold tabular-nums" style={{ color: '#059669' }}>{pIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>
                      <div><span className="text-gray-500">Out: </span><span className={`font-semibold tabular-nums ${pOut ? 'text-red-600' : 'text-amber-600'}`}>{pOut ? pOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span></div>
                      {punch.breaks && punch.breaks.length > 0 && (<div><span className="text-gray-500">Breaks: </span>{punch.breaks.map((b: any, i: number) => (<span key={i} className="font-medium text-amber-700">{i > 0 && ', '}{new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{b.end ? `–${new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (active)'}</span>))}</div>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Department Detail Modal */}
      {showDepartmentModal && selectedDepartment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
          <div className="w-full max-w-2xl mx-4 bg-white rounded-3xl shadow-2xl">
            <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedDepartment}</h2>
                <p className="text-sm text-gray-500 mt-1">{groupedByDepartment[selectedDepartment]?.length || 0} team members</p>
              </div>
              <button onClick={() => { setShowDepartmentModal(false); setSelectedDepartment(null); }} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-3">
              {(groupedByDepartment[selectedDepartment] || []).map(emp => {
                const live = liveEmployeeStatus.find(l => l._id === emp._id);
                return (
                  <div key={getId(emp)} className="rounded-2xl border p-5 flex items-center justify-between" style={{ borderColor: live?.status === 'working' ? '#86efac' : live?.status === 'break' ? '#fcd34d' : '#e5e7eb', backgroundColor: live?.status === 'working' ? '#f0fdf4' : live?.status === 'break' ? '#fffbeb' : '#fafafa' }}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold" style={{ background: emp.level === 'Manager' ? 'linear-gradient(135deg, #f59e0b, #b45309)' : 'linear-gradient(135deg, #60a5fa, #2563eb)' }}>
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{emp.name}</div>
                        <div className="text-sm text-gray-600">{emp.role}</div>
                        <div className="text-xs text-gray-400">{emp.email}</div>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      {emp.level === 'Manager' && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#d97706' }}><Crown className="w-3 h-3" /> Manager</span>}
                      <div className="text-sm font-semibold text-gray-700">${emp.hourlyRate}/hr</div>
                      {live?.status !== 'punched_out' && <div className="text-xs font-medium" style={{ color: live?.status === 'working' ? '#16a34a' : '#d97706' }}>{live?.status === 'working' ? 'Working' : 'On Break'} — {live?.currentDuration}</div>}
                    </div>
                  </div>
                );
              })}
              {(!groupedByDepartment[selectedDepartment] || groupedByDepartment[selectedDepartment].length === 0) && (
                <div className="p-8 text-center text-gray-400 rounded-2xl border-2 border-dashed border-gray-200">No employees in this department</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Employee Management Modal */}
      <Dialog open={showEmployeeManagement} onOpenChange={setShowEmployeeManagement}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-2xl">Employee Management</DialogTitle><DialogDescription>Manage roles, promote/demote, add or remove employees</DialogDescription></DialogHeader>
          <div className="flex justify-end mt-2">
            <button className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB' }} onClick={() => setShowAddEmployeeModal(true)}><Plus className="w-4 h-4" /> Add Employee</button>
          </div>
          <div className="space-y-6 mt-4">
            <div>
              <div className="flex items-center gap-2 mb-3"><Crown className="w-4 h-4 text-amber-600" /><span className="font-semibold">Managers ({groupedByLevel.Manager.length})</span></div>
              <div className="space-y-2">
                {groupedByLevel.Manager.map(emp => (
                  <div key={getId(emp)} className="p-5 rounded-2xl border-2 border-amber-200 bg-amber-50 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}>{emp.name.split(' ').map(n => n[0]).join('')}</div>
                      <div><div className="font-semibold">{emp.name}</div><div className="text-sm text-gray-600">{emp.role} — {emp.department}</div><div className="text-xs text-gray-500">{emp.email}</div></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">${emp.hourlyRate}/hr</Badge>
                      <Button size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setSelectedEmployee(emp); setShowPromoteModal(true); }}><ArrowDownCircle className="w-4 h-4 mr-1" /> Demote</Button>
                      <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600" onClick={() => { setSelectedEmployee(emp); setShowRemoveModal(true); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
                {groupedByLevel.Manager.length === 0 && <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">No managers assigned.</div>}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-blue-600" /><span className="font-semibold">Employees ({groupedByLevel.Employee.length})</span></div>
              <div className="space-y-2">
                {groupedByLevel.Employee.map(emp => (
                  <div key={getId(emp)} className="p-5 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-between group hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #60a5fa, #2563eb)' }}>{emp.name.split(' ').map(n => n[0]).join('')}</div>
                      <div><div className="font-semibold">{emp.name}</div><div className="text-sm text-gray-600">{emp.role} — {emp.department}</div><div className="text-xs text-gray-500">{emp.email}</div></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">${emp.hourlyRate}/hr</Badge>
                      <Button size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity border-green-200 text-green-600 hover:bg-green-50" onClick={() => { setSelectedEmployee(emp); setShowPromoteModal(true); }}><ArrowUpCircle className="w-4 h-4 mr-1" /> Promote</Button>
                      <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600" onClick={() => { setSelectedEmployee(emp); setShowRemoveModal(true); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Employee Modal */}
      <Dialog open={showAddEmployeeModal} onOpenChange={setShowAddEmployeeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl">Add New Employee</DialogTitle><DialogDescription>Add a new team member</DialogDescription></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Full Name</Label><Input placeholder="e.g. Jane Doe" value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} className="rounded-xl h-11" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="jane@restaurant.com" value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} className="rounded-xl h-11" /></div>
            <div className="space-y-2"><Label>Initial Password (min 6 chars)</Label><Input type="password" placeholder="Employee can change this later" value={newEmployee.password} onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })} className="rounded-xl h-11" /></div>
            <div className="space-y-2"><Label>Role</Label><Select value={newEmployee.role} onValueChange={v => setNewEmployee({ ...newEmployee, role: v })}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent>{['Server', 'Bartender', 'Chef', 'Manager'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Department</Label><Select value={newEmployee.department} onValueChange={v => setNewEmployee({ ...newEmployee, department: v })}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent>{['Front of House', 'Kitchen', 'Bar', 'Management'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Hourly Rate ($)</Label><Input type="number" min="0" value={newEmployee.hourlyRate} onChange={e => setNewEmployee({ ...newEmployee, hourlyRate: Number(e.target.value) })} className="rounded-xl h-11" /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-full h-11" onClick={() => setShowAddEmployeeModal(false)}>Cancel</Button>
              <button className="flex-1 rounded-full h-11 inline-flex items-center justify-center text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB' }} onClick={handleAddEmployee}>Add Employee</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Financial Report Modal */}
      <Dialog open={showFinancialReport} onOpenChange={setShowFinancialReport}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-2xl">Financial Reports</DialogTitle><DialogDescription>Comprehensive wages, tips, and labor cost analytics</DialogDescription></DialogHeader>
          <div className="space-y-6 mt-4">
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-[#2563EB]" /> Daily — {todayLabel}</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl border" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderColor: '#6ee7b7' }}><div className="text-sm text-gray-600 mb-2">Wages</div><div className="text-3xl font-black" style={{ color: '#059669' }}>${dailyReport?.totalWages.toFixed(2) || '0.00'}</div><div className="text-sm text-gray-600 mt-2">{dailyReport?.totalHours.toFixed(1) || '0'} hours</div></div>
                <div className="p-5 rounded-2xl border" style={{ background: 'linear-gradient(135deg, #faf5ff, #ede9fe)', borderColor: '#c4b5fd' }}><div className="text-sm text-gray-600 mb-2">Tips</div><div className="text-3xl font-black" style={{ color: '#7c3aed' }}>${dailyReport?.totalTips.toFixed(2) || '0.00'}</div><div className="text-sm text-gray-600 mt-2">Proportional split</div></div>
                <div className="p-5 rounded-2xl border" style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderColor: '#93c5fd' }}><div className="text-sm text-gray-600 mb-2">Combined</div><div className="text-3xl font-black" style={{ color: '#2563eb' }}>${((dailyReport?.totalWages || 0) + (dailyReport?.totalTips || 0)).toFixed(2)}</div><div className="text-sm text-gray-600 mt-2">Total payout</div></div>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#2563EB]" /> Weekly</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50"><div className="text-sm text-gray-600 mb-2">Wages (Week)</div><div className="text-2xl font-bold">${weeklyReport?.totalWages.toFixed(2) || '0.00'}</div><div className="text-sm text-gray-500 mt-2">{weeklyReport?.hoursWorked.toFixed(1) || '0'} hours</div></div>
                <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50"><div className="text-sm text-gray-600 mb-2">Tips (Week)</div><div className="text-2xl font-bold">${weeklyReport?.totalTips.toFixed(2) || '0.00'}</div><div className="text-sm text-gray-500 mt-2">Combined: ${((weeklyReport?.totalWages || 0) + (weeklyReport?.totalTips || 0)).toFixed(2)}</div></div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Promote/Demote Modal */}
      <Dialog open={showPromoteModal} onOpenChange={setShowPromoteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-2xl">{selectedEmployee?.level === 'Manager' ? 'Demote Manager' : 'Promote to Manager'}</DialogTitle><DialogDescription>{selectedEmployee?.level === 'Manager' ? 'Remove manager privileges' : 'Grant manager privileges'}</DialogDescription></DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6 mt-4">
              <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #60a5fa, #2563eb)' }}>{selectedEmployee.name.split(' ').map(n => n[0]).join('')}</div>
                <div><div className="font-semibold text-lg">{selectedEmployee.name}</div><div className="text-sm text-gray-600">{selectedEmployee.role} — {selectedEmployee.department}</div></div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3"><Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" /><div><div className="font-semibold text-amber-900">{selectedEmployee.level === 'Manager' ? 'This will remove manager access' : 'This will grant full manager access'}</div><div className="text-sm text-amber-700 mt-1">{selectedEmployee.level === 'Manager' ? 'They will lose schedule, approval, and manager features.' : 'They will gain schedule, approval, and all manager features.'}</div></div></div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setShowPromoteModal(false)}>Cancel</Button>
                <button className="flex-1 rounded-xl h-12 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white" style={{ backgroundColor: selectedEmployee.level === 'Manager' ? '#d97706' : '#16a34a' }} onClick={() => handlePromote(selectedEmployee)}>
                  {selectedEmployee.level === 'Manager' ? <><ArrowDownCircle className="w-4 h-4" /> Demote</> : <><ArrowUpCircle className="w-4 h-4" /> Promote</>}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Employee Modal */}
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-2xl">Remove Employee</DialogTitle><DialogDescription>Permanently remove this employee</DialogDescription></DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6 mt-4">
              <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #f87171, #dc2626)' }}>{selectedEmployee.name.split(' ').map(n => n[0]).join('')}</div>
                <div><div className="font-semibold text-lg">{selectedEmployee.name}</div><div className="text-sm text-gray-600">{selectedEmployee.role} — {selectedEmployee.department}</div></div>
              </div>
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200"><div className="flex items-start gap-3"><UserX className="w-5 h-5 text-red-600 mt-0.5 shrink-0" /><div><div className="font-semibold text-red-900">This action cannot be undone</div><div className="text-sm text-red-700 mt-1">All data, shifts, and history will be deleted.</div></div></div></div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setShowRemoveModal(false)}>Cancel</Button>
                <button className="flex-1 rounded-xl h-12 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white" style={{ backgroundColor: '#dc2626' }} onClick={() => handleRemoveEmployee(selectedEmployee)}><Trash2 className="w-4 h-4" /> Remove</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Profile Modal */}
      <Dialog open={showAdminProfile} onOpenChange={setShowAdminProfile}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-2xl">Admin Profile</DialogTitle><DialogDescription>Your account information</DialogDescription></DialogHeader>
          <div className="space-y-6 mt-4">
            {adminProfileMessage && <div className={`p-3 rounded-lg text-sm ${adminProfileMessage.toLowerCase().includes('updated') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{adminProfileMessage}</div>}
            <div className="flex items-center gap-5 p-6 rounded-2xl border border-amber-100" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold" style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}>{(adminProfile.name || user.name)?.[0]?.toUpperCase() || 'A'}</div>
              <div className="flex-1"><h3 className="text-2xl font-bold">{adminProfile.name || user.name || 'Admin'}</h3><p className="text-gray-600">{user.email}</p><span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#b45309' }}><Crown className="w-3 h-3" /> Admin</span></div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Profile Information</h3>
              <div className="grid gap-4">
                <div className="space-y-2"><Label>Full Name</Label><Input disabled={!adminProfileEditing} value={adminProfile.name} onChange={e => setAdminProfile({ ...adminProfile, name: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" disabled={!adminProfileEditing} value={adminProfile.dob} onChange={e => setAdminProfile({ ...adminProfile, dob: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Address</Label><Input disabled={!adminProfileEditing} value={adminProfile.address} placeholder="Street, City, State, ZIP" onChange={e => setAdminProfile({ ...adminProfile, address: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input disabled={!adminProfileEditing} value={adminProfile.phone} placeholder="Phone number" onChange={e => setAdminProfile({ ...adminProfile, phone: e.target.value })} className="rounded-xl" /></div>
              </div>
              {adminProfileEditing ? (
                <div className="flex gap-2"><Button variant="outline" onClick={() => setAdminProfileEditing(false)}>Cancel</Button><button className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB' }} onClick={async () => { try { await api.updateProfile(adminProfile, user.token); setAdminProfileMessage('Profile updated.'); setAdminProfileEditing(false); setTimeout(() => setAdminProfileMessage(null), 3000); } catch (e: any) { setAdminProfileMessage(e.message || 'Failed'); } }}>Save</button></div>
              ) : (<Button variant="outline" onClick={() => setAdminProfileEditing(true)}>Edit Profile</Button>)}
            </div>
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold">Change Password</h3>
              <div className="grid gap-4">
                <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={adminPasswordForm.current} onChange={e => setAdminPasswordForm({ ...adminPasswordForm, current: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>New Password (min 6 chars)</Label><Input type="password" value={adminPasswordForm.new} onChange={e => setAdminPasswordForm({ ...adminPasswordForm, new: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" value={adminPasswordForm.confirm} onChange={e => setAdminPasswordForm({ ...adminPasswordForm, confirm: e.target.value })} className="rounded-xl" /></div>
                <button className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB' }} onClick={async () => { if (adminPasswordForm.new !== adminPasswordForm.confirm) { setAdminProfileMessage('Passwords do not match.'); return; } try { await api.changePassword(adminPasswordForm.current, adminPasswordForm.new, user.token); setAdminProfileMessage('Password updated.'); setAdminPasswordForm({ current: '', new: '', confirm: '' }); setTimeout(() => setAdminProfileMessage(null), 3000); } catch (e: any) { setAdminProfileMessage(e.message || 'Failed'); } }}>Update Password</button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* System Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl">System Settings</DialogTitle><DialogDescription>Restaurant system configuration</DialogDescription></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50"><div className="flex items-center gap-3 mb-2"><Shield className="w-5 h-5 text-blue-600" /><span className="font-semibold">Security</span></div><p className="text-sm text-gray-600">JWT authentication enabled. All API routes are protected with role-based access.</p></div>
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50"><div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-blue-600" /><span className="font-semibold">Business Hours</span></div><p className="text-sm text-gray-600">Time tracking is available 24/7. Shifts can be scheduled for any time slot.</p></div>
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50"><div className="flex items-center gap-3 mb-2"><Users className="w-5 h-5 text-blue-600" /><span className="font-semibold">Roles & Permissions</span></div><p className="text-sm text-gray-600">Admin: full control. Manager: scheduling, approvals. Employee: punch in/out, view schedule.</p></div>
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50"><div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-blue-600" /><span className="font-semibold">Tips Distribution</span></div><p className="text-sm text-gray-600">Tips are pooled daily and distributed proportionally based on hours worked per employee.</p></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
