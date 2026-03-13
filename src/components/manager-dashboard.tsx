import { Calendar, Users, RefreshCw, Plus, FileText, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { ScheduleBuilder } from './schedule-builder';
import { DateTimePanel } from './datetime-panel';
import { Clock, Mail, Phone, MapPin, Building2, Shield, Settings, Bell, Trash2, LogIn, LogOut, Coffee } from 'lucide-react';
import { addDays, calculateShiftDurationHours, formatHours, formatLongDate, formatMonthDay, startOfWeek, toISODate } from '../utils/time';
import { api } from '../api/client';
import { useEffect } from 'react';

type Props = {
  onNavigate: (page: string) => void;
  onLogout: () => void;
  user: { id: string; name: string; email?: string; role: string; token: string };
};

type Shift = {
  employee: string;
  employeeId?: string;
  role: string;
  startTime: string;
  endTime: string;
  date: string;
};

type Employee = {
  _id: string;
  name: string;
  role: string;
  status?: string;
  hourlyRate?: number;
  email?: string;
};

type Punch = {
  _id: string;
  employeeId: string;
  employeeName: string;
  clockIn: string;
  clockOut?: string;
  breaks: { start: string; end?: string }[];
};

type SwapRequest = {
  _id: string;
  employee: string;
  employeeId?: string;
  shift: string;
  role: string;
  reason: string;
  type: 'swap' | 'leave';
  status: 'pending' | 'approved' | 'declined';
  managerNote?: string;
  createdAt: string;
};

export function ManagerDashboard({ onNavigate, onLogout, user }: Props) {
  const today = new Date();
  const currentHour = today.getHours();
  const todayIso = toISODate(today);
  const todayLabel = formatLongDate(today);
  const biWeeklyStart = startOfWeek(today);
  const biWeeklyEnd = addDays(biWeeklyStart, 13);
  const week1Start = biWeeklyStart;
  const week1End = addDays(week1Start, 6);
  const week2Start = addDays(biWeeklyStart, 7);
  const week2End = addDays(week2Start, 6);
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [showSwapRequestsModal, setShowSwapRequestsModal] = useState(false);
  const [showCreateShiftModal, setShowCreateShiftModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showDayScheduleModal, setShowDayScheduleModal] = useState(false);
  const [showScheduleBuilder, setShowScheduleBuilder] = useState(false);
  const [showManagerProfile, setShowManagerProfile] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{date: string, day: string, weekLabel: string} | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [declineNotes, setDeclineNotes] = useState<Record<string, string>>({});
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  
  // Shift management state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [tips, setTips] = useState<{ _id: string; amount: number; date: string; notes?: string }[]>([]);
  const [tipAmount, setTipAmount] = useState<string>('');
  const [tipNotes, setTipNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '', email: '', password: '', role: 'Server', department: 'Front of House', hourlyRate: 16
  });
  const [managerProfile, setManagerProfile] = useState({ name: '', dob: '', address: '', phone: '' });
  const [managerProfileEditing, setManagerProfileEditing] = useState(false);
  const [managerPasswordForm, setManagerPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [managerProfileMessage, setManagerProfileMessage] = useState<string | null>(null);
  const [showAllPunchesModal, setShowAllPunchesModal] = useState(false);
  const onHolidayEmployees: Employee[] = [];
  
  // Create shift form state
  const [newShift, setNewShift] = useState({
    employee: '',
    role: '',
    startTime: '',
    endTime: '',
    date: ''
  });

  const swapRequests = requests.filter((r) => r.status === 'pending');

  const managerEmployee = employees.find((e) => e.email === user.email || String((e as any).userId) === user.id);
  const managerPunch = punches.find((p) => (p.employeeId === managerEmployee?._id || p.employeeId === user.id) && !p.clockOut);
  const managerPunchStatus = managerPunch
    ? (managerPunch.breaks?.some((b: any) => !b.end) ? 'break' : 'working')
    : 'punched_out';

  const liveEmployeeStatus = employees.map((emp) => {
    const openPunch = punches.find((p) => (p.employeeId === emp._id || p.employeeId === String((emp as any).userId ?? '')) && !p.clockOut);
    const lastBreak = openPunch?.breaks?.[openPunch.breaks.length - 1];
    const durationMinutes = openPunch ? Math.max(0, (Date.now() - new Date(openPunch.clockIn).getTime()) / 60000) : 0;
    const status = openPunch
      ? lastBreak && !lastBreak.end
        ? 'break'
        : 'working'
      : 'punched_out';
    return {
      name: emp.name,
      role: emp.role,
      status,
      punchInTime: openPunch ? new Date(openPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      breakStart: lastBreak?.start ? new Date(lastBreak.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      punchOutTime: openPunch?.clockOut,
      totalHours: '',
      avatar: emp.name.split(' ').map((n) => n[0]).join(''),
      currentDuration: openPunch ? `${Math.floor(durationMinutes / 60)}h ${Math.floor(durationMinutes % 60)}m` : '',
    };
  });

  const todaysShifts = shifts.filter(shift => (shift.date || '').split('T')[0] === todayIso);

  const handleApproveRequest = (employeeName: string, type: string) => {
    setConfirmationMessage(`${type === 'swap' ? 'Swap' : 'Leave'} request from ${employeeName} has been approved!`);
    setTimeout(() => setConfirmationMessage(null), 3000);
  };

  const handleDeclineRequest = (employeeName: string, type: string) => {
    setConfirmationMessage(`${type === 'swap' ? 'Swap' : 'Leave'} request from ${employeeName} has been declined.`);
    setTimeout(() => setConfirmationMessage(null), 3000);
  };

  const handleCreateShift = () => {
    const { employee, role, startTime, endTime, date } = newShift;
    const duration = calculateShiftDurationHours(startTime, endTime);

    if (!employee || !role || !startTime || !endTime || !date || duration <= 0) {
      setConfirmationMessage('Please complete all fields and ensure end time is after start time.');
      setTimeout(() => setConfirmationMessage(null), 3000);
      return;
    }

    const emp = employees.find(e => e.name === employee);
    api.createShift({ ...newShift, employeeId: emp?._id, durationHours: duration }, user.token)
      .then((created: any) => setShifts([...shifts, created]))
      .catch((err) => setConfirmationMessage(err.message));
    setNewShift({ employee: '', role: '', startTime: '', endTime: '', date: '' });
    setShowCreateShiftModal(false);
  };

  const handlePublishSchedule = () => {
    setConfirmationMessage('Schedule published successfully!');
    setTimeout(() => setConfirmationMessage(null), 3000);
    setShowPublishModal(false);
  };

  const handleDaySchedule = (day: string, date: string, weekLabel: string) => {
    setSelectedDay({ date, day, weekLabel });
    setShowDayScheduleModal(true);
  };

  const handleRemoveEmployee = (employeeId: string, employeeName: string) => {
    api.deleteEmployee(employeeId, user.token)
      .then(() => {
        setEmployees(employees.filter(emp => emp._id !== employeeId));
        setConfirmationMessage(`${employeeName} has been removed from the team.`);
      })
      .catch((err) => setConfirmationMessage(err.message));
    setTimeout(() => setConfirmationMessage(null), 3000);
  };

  const handleRequestAction = async (requestId: string, status: 'approved' | 'declined') => {
    const note = status === 'declined' ? (declineNotes[requestId] || '') : '';
    try {
      setProcessingRequestId(requestId);
      await api.updateRequest(requestId, { status, managerNote: note }, user.token);
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
      setConfirmationMessage(
        `Request ${status === 'approved' ? 'approved' : 'declined'}${note ? `: ${note}` : ''}`
      );
    } catch (err: any) {
      setConfirmationMessage(err.message || 'Failed to update request.');
    } finally {
      setProcessingRequestId(null);
      setTimeout(() => setConfirmationMessage(null), 3000);
    }
  };

  const handleAddTip = async () => {
    const amount = parseFloat(tipAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setConfirmationMessage('Enter a valid tip amount.');
      return;
    }
    try {
      const created = await api.createTip({ amount, date: todayIso, notes: tipNotes }, user.token);
      setTips([...tips, created]);
      setTipAmount('');
      setTipNotes('');
      setConfirmationMessage('Tips pool updated.');
    } catch (err: any) {
      setConfirmationMessage(err.message);
    }
    setTimeout(() => setConfirmationMessage(null), 3000);
  };

  const handleAddEmployee = async () => {
    const { name, email, password, role, department, hourlyRate } = newEmployee;
    if (!name || !email) {
      setConfirmationMessage('Name and email are required.');
      setTimeout(() => setConfirmationMessage(null), 3000);
      return;
    }
    if (!password || password.length < 6) {
      setConfirmationMessage('Password must be at least 6 characters so the employee can sign in.');
      setTimeout(() => setConfirmationMessage(null), 3000);
      return;
    }
    try {
      const created = await api.createEmployee(
        { name, email, password, role, department, level: 'Employee', hourlyRate: Number(hourlyRate), status: 'active' },
        user.token
      );
      setEmployees((prev) => [...prev, created as Employee]);
      setNewEmployee({ name: '', email: '', password: '', role: 'Server', department: 'Front of House', hourlyRate: 16 });
      setShowAddEmployeeModal(false);
      setConfirmationMessage(`${name} has been added to the team! They can sign in with this email and password.`);
    } catch (err: any) {
      setConfirmationMessage(err.message || 'Failed to add employee.');
    }
    setTimeout(() => setConfirmationMessage(null), 3000);
  };

  const week1StartIso = toISODate(week1Start);
  const week2EndIso = toISODate(week2End);

  const refreshShifts = async () => {
    try {
      const shiftList = await api.getShifts({ start: week1StartIso, end: week2EndIso }, user.token);
      setShifts(shiftList as Shift[]);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const p = await api.getProfile(user.token);
        setManagerProfile({ name: p.name || '', dob: p.dob || '', address: p.address || '', phone: p.phone || '' });
      } catch {}
    };
    loadProfile();
  }, [user.token, showManagerProfile]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [empList, shiftList, punchList, tipList, requestList, report] = await Promise.all([
          api.getEmployees(user.token),
          api.getShifts({ start: week1StartIso, end: week2EndIso }, user.token),
          api.getPunches({}, user.token),
          api.getTips(todayIso, user.token),
          api.getRequests('pending', user.token),
          api.getDailyReport(todayIso, user.token),
        ]);
        setEmployees(empList as Employee[]);
        setShifts(shiftList as Shift[]);
        setPunches(punchList as Punch[]);
        setTips(tipList as any[]);
        setRequests(requestList as SwapRequest[]);
        setDailyReport(report);
      } catch (err: any) {
        setConfirmationMessage(err.message || 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    load();

    const interval = setInterval(async () => {
      try {
        const [requestList, report, tipList, punchList] = await Promise.all([
          api.getRequests('pending', user.token),
          api.getDailyReport(todayIso, user.token),
          api.getTips(todayIso, user.token),
          api.getPunches({}, user.token),
        ]);
        setRequests(requestList as SwapRequest[]);
        setDailyReport(report);
        setTips(tipList as any[]);
        setPunches(punchList as Punch[]);
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user.token, week1StartIso, week2EndIso, todayIso]);

  return (
    <div className="min-h-screen">
      {showScheduleBuilder ? (
        <ScheduleBuilder
          token={user.token}
          onClose={() => {
            setShowScheduleBuilder(false);
            refreshShifts();
          }}
        />
      ) : (
        <>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl tracking-tight">
                <span className="font-semibold text-[#2563EB]">Shift</span><span className="text-black">ora</span>
              </span>
            </div>
            <Badge variant="secondary" className="rounded-full">Manager</Badge>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <button className="text-gray-900">Dashboard</button>
            <button 
              onClick={() => onNavigate('wages')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Wages & Tips
            </button>
          </div>

          <div className="flex items-center gap-3">
            <DateTimePanel />
            <button
              onClick={() => setShowManagerProfile(true)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
            >
              {user.name ? user.name[0].toUpperCase() : 'M'}
            </button>
            <Button 
              variant="ghost" 
              onClick={onLogout}
              className="hidden sm:inline-flex"
            >
              Log out
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl">{greeting}, {user.name || 'Manager'}.</h1>
          <p className="text-gray-600">Here's what's happening with your team today.</p>
        </div>

        {/* Manager Time Clock - Top */}
        <div className="rounded-2xl border-2 border-orange-300 bg-orange-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: managerPunchStatus === 'working' ? '#d1fae5' : managerPunchStatus === 'break' ? '#fef3c7' : '#ffedd5', borderBottom: managerPunchStatus === 'working' ? '2px solid #6ee7b7' : managerPunchStatus === 'break' ? '2px solid #fbbf24' : '2px solid #fdba74' }}>
            <h2 className="text-xl font-bold" style={{ color: managerPunchStatus === 'working' ? '#065f46' : managerPunchStatus === 'break' ? '#92400e' : '#9a3412' }}>My Time Clock</h2>
            {managerPunchStatus === 'working' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#059669' }}>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Punched In
              </span>
            )}
            {managerPunchStatus === 'break' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#d97706' }}>
                <Coffee className="w-4 h-4" />
                On Break
              </span>
            )}
            {managerPunchStatus === 'punched_out' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#ea580c' }}>
                <LogIn className="w-4 h-4" />
                Not Punched In
              </span>
            )}
          </div>

          <div className="p-6 bg-white space-y-4">
            {/* Status info row */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: managerPunchStatus === 'working' ? '#059669' : managerPunchStatus === 'break' ? '#d97706' : '#ea580c' }}>
                {managerPunchStatus === 'working' ? <Clock className="w-7 h-7 text-white" /> : managerPunchStatus === 'break' ? <Coffee className="w-7 h-7 text-white" /> : <LogIn className="w-7 h-7 text-white" />}
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {managerPunchStatus === 'working' ? 'Currently Working' : managerPunchStatus === 'break' ? 'On Break' : 'Ready to punch in'}
                </div>
                {managerPunch ? (
                  <div className="text-sm text-gray-600">
                    Punched in at {new Date(managerPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Don't forget to punch in for your shift!</div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {managerPunchStatus === 'punched_out' && (
                <button
                  className="sm:col-span-2 inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-4 text-base font-bold text-white shadow-lg transition-all"
                  style={{ backgroundColor: '#ea580c' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c2410c')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                  onClick={async () => {
                    try {
                      await api.clockIn({ employeeId: managerEmployee?._id || user.id }, user.token);
                      const p = await api.getPunches({}, user.token);
                      setPunches(p as Punch[]);
                    } catch (e: any) {
                      setConfirmationMessage(e.message || 'Failed to punch in');
                    }
                  }}
                >
                  <LogIn className="w-5 h-5" />
                  Punch In
                </button>
              )}
              {managerPunchStatus === 'working' && (
                <>
                  <button
                    className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-amber-400 px-6 py-4 text-base font-bold transition-all"
                    style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fde68a')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fef3c7')}
                    onClick={async () => {
                      try {
                        await api.breakStart({ employeeId: managerEmployee?._id || user.id }, user.token);
                        const p = await api.getPunches({}, user.token);
                        setPunches(p as Punch[]);
                      } catch {}
                    }}
                  >
                    <Coffee className="w-5 h-5" />
                    Start Break
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-red-400 px-6 py-4 text-base font-bold transition-all"
                    style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fecaca')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                    onClick={async () => {
                      try {
                        await api.clockOut({ employeeId: managerEmployee?._id || user.id }, user.token);
                        const p = await api.getPunches({}, user.token);
                        setPunches(p as Punch[]);
                      } catch {}
                    }}
                  >
                    <LogOut className="w-5 h-5" />
                    Punch Out
                  </button>
                </>
              )}
              {managerPunchStatus === 'break' && (
                <button
                  className="sm:col-span-2 inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-4 text-base font-bold text-white shadow-lg transition-all"
                  style={{ backgroundColor: '#059669' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#047857')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
                  onClick={async () => {
                    try {
                      await api.breakEnd({ employeeId: managerEmployee?._id || user.id }, user.token);
                      const p = await api.getPunches({}, user.token);
                      setPunches(p as Punch[]);
                    } catch {}
                  }}
                >
                  <Coffee className="w-5 h-5" />
                  End Break & Resume
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid md:grid-cols-3 gap-6">
          <button 
            onClick={() => setShowShiftsModal(true)}
            className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 hover:border-blue-200 transition-all text-left cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-3xl">{shifts.filter(s => (s.date || '').split('T')[0] === todayIso).length}</span>
            </div>
            <div className="text-gray-600">Shifts today</div>
            <div className="text-sm text-[#2563EB] mt-2">View all →</div>
          </button>

          <button 
            onClick={() => setShowEmployeesModal(true)}
            className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 hover:border-green-200 transition-all text-left cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-3xl">{employees.length}</span>
            </div>
            <div className="text-gray-600">Active employees</div>
            <div className="text-sm text-[#22C55E] mt-2">View all →</div>
          </button>

          <button 
            onClick={() => setShowSwapRequestsModal(true)}
            className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 hover:border-amber-200 transition-all text-left cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-3xl">{swapRequests.length}</span>
            </div>
            <div className="text-gray-600">Open swap requests</div>
            <div className="text-sm text-amber-600 mt-2">Review now →</div>
          </button>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Bi-weekly schedule */}
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl">Bi-weekly schedule</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {formatMonthDay(biWeeklyStart)} – {formatMonthDay(biWeeklyEnd)}
                </p>
              </div>
              <Button 
                size="sm" 
                className="rounded-full bg-[#2563EB] hover:bg-[#1d4ed8]"
                onClick={() => setShowScheduleBuilder(true)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add shifts
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-2">
                  Week 1 ({formatMonthDay(week1Start)}-{formatMonthDay(week1End)})
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                    const dateIso = toISODate(addDays(week1Start, index));
                    const isToday = dateIso === todayIso;
                    const dayShiftCount = shifts.filter(s => (s.date || '').split('T')[0] === dateIso).length;
                    return (
                      <div 
                        key={`w1-${day}`}
                        className={`rounded-xl p-2 text-center cursor-pointer hover:border-blue-300 transition-colors ${
                          isToday ? 'bg-blue-100 border-2 border-blue-300' : 'bg-gray-50 border border-gray-200'
                        }`}
                        onClick={() => handleDaySchedule(day, dateIso, 'Week 1')}
                      >
                        <div className="text-xs text-gray-500 mb-1">{day}</div>
                        <div className={`${isToday ? 'text-blue-700' : ''}`}>
                          {dayShiftCount}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">shifts</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-2">
                  Week 2 ({formatMonthDay(week2Start)}-{formatMonthDay(week2End)})
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                    const dateIso = toISODate(addDays(week2Start, index));
                    const isToday = dateIso === todayIso;
                    const dayShiftCount = shifts.filter(s => (s.date || '').split('T')[0] === dateIso).length;
                    return (
                      <div 
                        key={`w2-${day}`}
                        className={`rounded-xl p-2 text-center cursor-pointer hover:border-blue-300 transition-colors ${
                          isToday ? 'bg-blue-100 border-2 border-blue-300 text-blue-700' : 'bg-gray-50 border border-dashed border-gray-300'
                        }`}
                        onClick={() => handleDaySchedule(day, dateIso, 'Week 2')}
                      >
                        <div className="text-xs text-gray-500 mb-1">{day}</div>
                        <div className={`${isToday ? 'text-blue-700' : 'text-gray-400'}`}>
                          {dayShiftCount}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">shifts</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button className="text-sm text-[#2563EB] hover:text-[#1d4ed8] flex items-center gap-1">
              View full schedule
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Pending swap requests with actions */}
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Pending requests</h2>
              <Badge variant="secondary" className="rounded-full">{swapRequests.length} new</Badge>
            </div>

            <div className="space-y-3">
              {swapRequests.slice(0, 3).map((request) => (
                <div key={request._id} className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{request.employee}</div>
                      <div className="text-sm text-gray-600">{request.shift}</div>
                    </div>
                    <Badge className={`${
                      request.type === 'swap' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    } hover:bg-opacity-100`}>
                      {request.type === 'swap' ? 'Swap' : 'Leave'}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">{request.reason}</div>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 text-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Add a note when declining (optional)"
                    value={declineNotes[request._id] || ''}
                    onChange={(e) =>
                      setDeclineNotes((prev) => ({ ...prev, [request._id]: e.target.value }))
                    }
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      className="flex-1 rounded-full bg-[#22C55E] hover:bg-[#22C55E]/90 h-8"
                      onClick={() => handleRequestAction(request._id, 'approved')}
                      disabled={processingRequestId === request._id}
                    >
                      {processingRequestId === request._id ? 'Updating…' : 'Approve'}
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-full border-red-200 text-red-600 hover:bg-red-50 h-8"
                      onClick={() => handleRequestAction(request._id, 'declined')}
                      disabled={processingRequestId === request._id}
                    >
                      {processingRequestId === request._id ? 'Updating…' : 'Decline'}
                    </Button>
                  </div>
                </div>
              ))}

              {swapRequests.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-600">
                  No pending requests right now.
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowSwapRequestsModal(true)}
              className="text-sm text-[#2563EB] hover:text-[#1d4ed8] flex items-center gap-1"
            >
              View all requests
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Employee Status Panel */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl">Live employee status</h2>
              <p className="text-xs text-gray-500 mt-1">Real-time punch in/out transparency</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                <span className="text-xs text-gray-600">Working ({liveEmployeeStatus.filter(e => e.status === 'working').length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-gray-600">Break ({liveEmployeeStatus.filter(e => e.status === 'break').length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-xs text-gray-600">Off ({liveEmployeeStatus.filter(e => e.status === 'punched_out').length})</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveEmployeeStatus.map((employee, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-xl border-2 transition-all ${
                  employee.status === 'working' 
                    ? 'border-green-200 bg-green-50' 
                    : employee.status === 'break'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                    employee.status === 'working'
                      ? 'bg-gradient-to-br from-green-400 to-green-600'
                      : employee.status === 'break'
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                      : 'bg-gradient-to-br from-gray-400 to-gray-600'
                  }`}>
                    {employee.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{employee.name}</div>
                    <div className="text-xs text-gray-600">{employee.role}</div>
                  </div>
                  <Badge className={`${
                    employee.status === 'working'
                      ? 'bg-[#22C55E] hover:bg-[#22C55E]'
                      : employee.status === 'break'
                      ? 'bg-amber-500 hover:bg-amber-500'
                      : 'bg-gray-500 hover:bg-gray-500'
                  }`}>
                    {employee.status === 'working' ? 'Working' : employee.status === 'break' ? 'Break' : 'Off'}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-600">
                      {employee.status === 'punched_out' ? 'Punched out' : 'Punched in'}: {employee.punchInTime}
                    </span>
                  </div>
                  {employee.status === 'break' && employee.breakStart && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3.5 h-3.5" />
                      <span className="text-gray-600">Break started: {employee.breakStart}</span>
                    </div>
                  )}
                  {employee.status === 'punched_out' && employee.punchOutTime && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3.5 h-3.5" />
                      <span className="text-gray-600">Punched out: {employee.punchOutTime}</span>
                    </div>
                  )}
                  <div className={`text-xs font-medium ${
                    employee.status === 'working'
                      ? 'text-green-700'
                      : employee.status === 'break'
                      ? 'text-amber-700'
                      : 'text-gray-700'
                  }`}>
                    {employee.status === 'punched_out' ? `Total: ${employee.totalHours}` : employee.currentDuration}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time Punches - All Staff (latest 4) */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl">Time Punches</h2>
              <p className="text-xs text-gray-500 mt-1">All punch in/out and break records</p>
            </div>
            <Badge variant="secondary" className="rounded-full">{punches.length} records</Badge>
          </div>

          <div className="space-y-3">
            {[...punches].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()).slice(0, 4).map((punch) => {
              const punchInTime = new Date(punch.clockIn);
              const punchOutTime = punch.clockOut ? new Date(punch.clockOut) : null;
              const duration = punchOutTime ? Math.round((punchOutTime.getTime() - punchInTime.getTime()) / 60000) : null;
              return (
                <div key={punch._id} className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 bg-gray-50/50 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                      {punch.employeeName?.slice(0, 2).toUpperCase() || '—'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{punch.employeeName}</div>
                      <div className="text-xs text-gray-500">
                        {punchInTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Punch in</div>
                      <div className="font-medium tabular-nums">{punchInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Punch out</div>
                      <div className="font-medium tabular-nums">{punchOutTime ? punchOutTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Duration</div>
                      <div className="font-medium">{duration != null ? `${Math.floor(duration / 60)}h ${duration % 60}m` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Breaks</div>
                      <div className="font-medium">
                        {punch.breaks && punch.breaks.length
                          ? punch.breaks.map((b: any, idx: number) => (
                              <span key={idx} className="block text-xs">
                                {new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {b.end ? ` – ${new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (active)'}
                              </span>
                            ))
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {punches.length === 0 && (
            <div className="p-8 text-center text-gray-500 rounded-xl border border-dashed border-gray-200">
              No punch records yet
            </div>
          )}
          {punches.length > 4 && (
            <button
              onClick={() => setShowAllPunchesModal(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-blue-200 text-[#2563EB] font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              See all {punches.length} records
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Bottom Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick actions */}
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <h2 className="text-xl mb-2">Quick actions</h2>

            <div className="space-y-3">
              <Button 
                className="w-full justify-start rounded-xl h-12 bg-[#2563EB] hover:bg-[#1d4ed8]"
                onClick={() => setShowCreateShiftModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create new shift
              </Button>

              <Button 
                variant="outline"
                className="w-full justify-start rounded-xl h-12"
                onClick={() => setShowPublishModal(true)}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Publish schedule
              </Button>

              <Button 
                variant="outline"
                className="w-full justify-start rounded-xl h-12"
                onClick={() => onNavigate('wages')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Open wages & tips report
              </Button>
            </div>
          </div>

          {/* Today's wages & tips */}
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <h2 className="text-xl">Today's wages & tips</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100">
                <div className="text-sm text-gray-600 mb-1">Total wages</div>
                <div className="text-2xl">${dailyReport ? dailyReport.totalWages.toFixed(2) : '0.00'}</div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100">
                <div className="text-sm text-gray-600 mb-1">Total tips</div>
                <div className="text-2xl">${dailyReport ? dailyReport.totalTips.toFixed(2) : '0.00'}</div>
              </div>
            </div>

            <button 
              onClick={() => onNavigate('wages')}
              className="flex items-center gap-2 text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
            >
              View full report
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tips Pool */}
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <h2 className="text-xl">Tips pool (today)</h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <Input
                  type="number"
                  min="0"
                  placeholder="Amount"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="rounded-xl"
                />
                <Button className="rounded-xl bg-[#2563EB]" onClick={handleAddTip}>
                  Add
                </Button>
              </div>
              <Input
                placeholder="Notes (optional)"
                value={tipNotes}
                onChange={(e) => setTipNotes(e.target.value)}
                className="rounded-xl"
              />
              <div className="text-sm text-gray-600">
                {tips.filter(t => t.date === todayIso).length} entries • $
                {tips
                  .filter(t => t.date === todayIso)
                  .reduce((sum, t) => sum + Number(t.amount || 0), 0)
                  .toFixed(2)}
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {tips
                  .filter(t => t.date === todayIso)
                  .slice(-5)
                  .reverse()
                  .map((tip) => (
                    <div key={tip._id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                      <span>${Number(tip.amount).toFixed(2)}</span>
                      <span className="text-gray-500">{tip.notes || 'No notes'}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation Toast */}
      {confirmationMessage && (
        <div className="fixed bottom-8 right-8 bg-[#22C55E] text-white px-6 py-4 rounded-2xl shadow-xl shadow-green-200/50 flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span>{confirmationMessage}</span>
        </div>
      )}

      {/* Shifts Today Modal */}
      <Dialog open={showShiftsModal} onOpenChange={setShowShiftsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Shifts Today</DialogTitle>
            <DialogDescription>
              All scheduled shifts for today, {todayLabel}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            {todaysShifts.length === 0 ? (
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600">
                No shifts scheduled for today.
              </div>
            ) : (
              todaysShifts.map((shift, index) => {
                const duration = calculateShiftDurationHours(shift.startTime, shift.endTime);
                return (
                  <div key={index} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                          {shift.employee.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium">{shift.employee}</div>
                          <div className="text-sm text-gray-600">{shift.startTime}–{shift.endTime}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="mb-1">{shift.role}</Badge>
                        <div className="text-sm text-gray-600">{formatHours(duration)} hours</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Employees Modal */}
      <Dialog open={showEmployeesModal} onOpenChange={setShowEmployeesModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">All Employees</DialogTitle>
            <DialogDescription>
              Manage your team — add, view, or remove employees
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-2">
            <Button
              className="rounded-full bg-[#2563EB] hover:bg-[#1d4ed8]"
              onClick={() => setShowAddEmployeeModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
          
          <div className="space-y-6 mt-4">
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                All Employees ({employees.length})
              </h3>
              <div className="space-y-2">
                {employees.map((employee, index) => (
                  <div key={employee._id || index} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between group hover:border-red-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-sm text-gray-600">{employee.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#22C55E] hover:bg-[#22C55E]">Active</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleRemoveEmployee(employee._id, employee.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                On Holiday ({onHolidayEmployees.length})
              </h3>
              <div className="space-y-2">
                {onHolidayEmployees.map((employee, index) => (
                  <div key={index} className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-sm text-gray-600">{employee.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-amber-500 hover:bg-amber-500 mb-1">Holiday</Badge>
                      <div className="text-xs text-gray-600">{employee.holidayDates}</div>
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
          <DialogHeader>
            <DialogTitle className="text-2xl">Add New Employee</DialogTitle>
            <DialogDescription>
              Add a new team member to your restaurant
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="emp-name">Full Name</Label>
              <Input
                id="emp-name"
                placeholder="e.g. Jane Doe"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-email">Email</Label>
              <Input
                id="emp-email"
                type="email"
                placeholder="jane@restaurant.com"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-password">Initial Password (min 6 chars)</Label>
              <Input
                id="emp-password"
                type="password"
                placeholder="Employee can change this later"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                className="rounded-xl h-11"
              />
              <p className="text-xs text-muted-foreground">Employee will use this to sign in and can change it in their dashboard.</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newEmployee.role} onValueChange={(v) => setNewEmployee({ ...newEmployee, role: v })}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Server', 'Bartender', 'Chef', 'Manager'].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={newEmployee.department} onValueChange={(v) => setNewEmployee({ ...newEmployee, department: v })}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Front of House', 'Kitchen', 'Bar', 'Management'].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-rate">Hourly Rate ($)</Label>
              <Input
                id="emp-rate"
                type="number"
                min="0"
                value={newEmployee.hourlyRate}
                onChange={(e) => setNewEmployee({ ...newEmployee, hourlyRate: Number(e.target.value) })}
                className="rounded-xl h-11"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full h-11"
                onClick={() => setShowAddEmployeeModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8]"
                onClick={handleAddEmployee}
              >
                Add Employee
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap/Leave Requests Modal */}
      <Dialog open={showSwapRequestsModal} onOpenChange={setShowSwapRequestsModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Pending Requests</DialogTitle>
            <DialogDescription>
              Review and approve or decline swap and leave requests from your team
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            {swapRequests.map((request) => (
              <div key={request._id} className="p-5 rounded-xl border-2 border-gray-200 bg-gray-50 space-y-3">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white">
                      {request.employee.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium text-lg">{request.employee}</div>
                      <div className="text-sm text-gray-600">{request.shift} · {request.role}</div>
                    </div>
                  </div>
                  <Badge className={`${
                    request.type === 'swap' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  } hover:bg-opacity-100`}>
                    {request.type === 'swap' ? 'Swap Request' : 'Leave Request'}
                  </Badge>
                </div>
                
                <div className="mb-4 p-3 rounded-lg bg-white border border-gray-200">
                  <div className="text-sm text-gray-500 mb-1">Reason:</div>
                  <div className="text-gray-900">{request.reason}</div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-600">Decline note (optional)</Label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Let the employee know why this request was declined."
                    value={declineNotes[request._id] || ''}
                    onChange={(e) =>
                      setDeclineNotes((prev) => ({ ...prev, [request._id]: e.target.value }))
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 rounded-xl bg-[#22C55E] hover:bg-[#22C55E]/90"
                    onClick={() => {
                      handleRequestAction(request._id, 'approved');
                    }}
                    disabled={processingRequestId === request._id}
                  >
                    {processingRequestId === request._id ? 'Updating…' : 'Approve'}
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      handleRequestAction(request._id, 'declined');
                    }}
                    disabled={processingRequestId === request._id}
                  >
                    {processingRequestId === request._id ? 'Updating…' : 'Decline'}
                  </Button>
                </div>
              </div>
            ))}

            {swapRequests.length === 0 && (
              <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-600">
                No pending requests right now.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Shift Modal */}
      <Dialog open={showCreateShiftModal} onOpenChange={setShowCreateShiftModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Create New Shift</DialogTitle>
            <DialogDescription>
              Add a new shift to the schedule
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee</Label>
              <Select
                value={newShift.employee}
                onValueChange={(value) => setNewShift({ ...newShift, employee: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee._id} value={employee.name}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newShift.role}
                onValueChange={(value) => setNewShift({ ...newShift, role: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {['Server', 'Bartender', 'Chef', 'Manager'].map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                type="date"
                value={newShift.date}
                onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                type="time"
                value={newShift.startTime}
                onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                type="time"
                value={newShift.endTime}
                onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                className="w-full"
              />
            </div>

            <Button
              className="w-full justify-start rounded-xl h-12 bg-[#2563EB] hover:bg-[#1d4ed8]"
              onClick={handleCreateShift}
            >
              Create Shift
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish Schedule Modal */}
      <Dialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Publish Schedule</DialogTitle>
            <DialogDescription>
              Confirm to publish the current schedule
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <p className="text-gray-600">Are you sure you want to publish the current schedule?</p>

            <Button
              className="w-full justify-start rounded-xl h-12 bg-[#2563EB] hover:bg-[#1d4ed8]"
              onClick={handlePublishSchedule}
            >
              Publish Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day Schedule Modal */}
      <Dialog open={showDayScheduleModal} onOpenChange={setShowDayScheduleModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Schedule for {selectedDay?.day}, {selectedDay?.date}</DialogTitle>
            <DialogDescription>
              View and manage shifts for {selectedDay?.weekLabel}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            {shifts.filter(shift => (shift.date || '').split('T')[0] === selectedDay?.date).map((shift, index) => (
              <div key={index} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                      {shift.employee.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium">{shift.employee}</div>
                      <div className="text-sm text-gray-600">{shift.startTime}–{shift.endTime}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="mb-1">{shift.role}</Badge>
                    <div className="text-sm text-gray-600">
                      {formatHours(calculateShiftDurationHours(shift.startTime, shift.endTime))} hours
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* All Time Punches Modal (Full-screen overlay) */}
      {showAllPunchesModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
          <div className="w-full max-w-4xl mx-4 bg-white rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 px-6 py-5 border-b border-gray-200 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">All Time Punches</h2>
                <p className="text-sm text-gray-500 mt-1">{punches.length} records — latest first</p>
              </div>
              <button
                onClick={() => setShowAllPunchesModal(false)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Records */}
            <div className="p-6 space-y-3">
              {punches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
                  <Clock className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="font-medium text-gray-600">No punch records yet</p>
                </div>
              ) : (
                [...punches]
                  .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())
                  .map((punch) => {
                    const pIn = new Date(punch.clockIn);
                    const pOut = punch.clockOut ? new Date(punch.clockOut) : null;
                    const dur = pOut ? Math.round((pOut.getTime() - pIn.getTime()) / 60000) : null;
                    const isActive = !pOut;
                    return (
                      <div
                        key={punch._id}
                        className={`rounded-xl border p-4 ${
                          isActive ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:bg-white'
                        } transition-colors`}
                      >
                        {/* Top: Employee name + date + active badge */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                            isActive ? 'bg-emerald-600' : 'bg-blue-600'
                          }`}>
                            {punch.employeeName?.slice(0, 2).toUpperCase() || '—'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900">{punch.employeeName}</div>
                            <div className="text-xs text-gray-500">
                              {pIn.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                          {isActive && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white">Active</span>
                          )}
                          {dur != null && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                              {Math.floor(dur / 60)}h {dur % 60}m
                            </span>
                          )}
                        </div>

                        {/* Bottom: Times row */}
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm pl-[52px]">
                          <div>
                            <span className="text-gray-500">In: </span>
                            <span className="font-semibold tabular-nums text-emerald-700">
                              {pIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Out: </span>
                            <span className={`font-semibold tabular-nums ${pOut ? 'text-red-600' : 'text-amber-600'}`}>
                              {pOut ? pOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                            </span>
                          </div>
                          {punch.breaks && punch.breaks.length > 0 && (
                            <div>
                              <span className="text-gray-500">Breaks: </span>
                              {punch.breaks.map((b: any, i: number) => (
                                <span key={i} className="font-medium text-amber-700">
                                  {i > 0 && ', '}
                                  {new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {b.end ? `–${new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (active)'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manager Profile Modal */}
      <Dialog open={showManagerProfile} onOpenChange={setShowManagerProfile}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Manager Profile</DialogTitle>
            <DialogDescription>View and manage your account information</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {managerProfileMessage && (
              <div className={`p-3 rounded-lg text-sm ${managerProfileMessage.startsWith('Updated') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {managerProfileMessage}
              </div>
            )}
            <div className="flex items-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-3xl">
                {(managerProfile.name || user.name)?.[0]?.toUpperCase() || 'M'}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl">{managerProfile.name || user.name || 'Manager'}</h3>
                <p className="text-gray-600">{user.email}</p>
                <Badge className="bg-[#2563EB] mt-2">Manager</Badge>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Profile Information</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input disabled={!managerProfileEditing} value={managerProfile.name} onChange={(e) => setManagerProfile({ ...managerProfile, name: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" disabled={!managerProfileEditing} value={managerProfile.dob} onChange={(e) => setManagerProfile({ ...managerProfile, dob: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input disabled={!managerProfileEditing} value={managerProfile.address} placeholder="Street, City, State, ZIP" onChange={(e) => setManagerProfile({ ...managerProfile, address: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input disabled={!managerProfileEditing} value={managerProfile.phone} placeholder="Phone number" onChange={(e) => setManagerProfile({ ...managerProfile, phone: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              {managerProfileEditing ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setManagerProfileEditing(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    try {
                      await api.updateProfile(managerProfile, user.token);
                      setManagerProfileMessage('Profile updated.');
                      setManagerProfileEditing(false);
                      setTimeout(() => setManagerProfileMessage(null), 3000);
                    } catch (e: any) {
                      setManagerProfileMessage(e.message || 'Failed to update');
                    }
                  }}>Save</Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setManagerProfileEditing(true)}>Edit Profile</Button>
              )}
            </div>

            <div className="space-y-4 border-t pt-6">
              <h3 className="font-medium">Change Password</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" value={managerPasswordForm.current} onChange={(e) => setManagerPasswordForm({ ...managerPasswordForm, current: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>New Password (min 6 chars)</Label>
                  <Input type="password" value={managerPasswordForm.new} onChange={(e) => setManagerPasswordForm({ ...managerPasswordForm, new: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={managerPasswordForm.confirm} onChange={(e) => setManagerPasswordForm({ ...managerPasswordForm, confirm: e.target.value })} className="rounded-xl" />
                </div>
                <Button onClick={async () => {
                  if (managerPasswordForm.new !== managerPasswordForm.confirm) {
                    setManagerProfileMessage('Passwords do not match.');
                    return;
                  }
                  try {
                    await api.changePassword(managerPasswordForm.current, managerPasswordForm.new, user.token);
                    setManagerProfileMessage('Password updated.');
                    setManagerPasswordForm({ current: '', new: '', confirm: '' });
                    setTimeout(() => setManagerProfileMessage(null), 3000);
                  } catch (e: any) {
                    setManagerProfileMessage(e.message || 'Failed to change password');
                  }
                }}>Update Password</Button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowManagerProfile(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}
