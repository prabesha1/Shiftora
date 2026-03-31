import { Calendar, Users, RefreshCw, Plus, FileText, ChevronRight, Loader2, Download, Pencil, Printer } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useState, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { ScheduleBuilder } from './schedule-builder';
import { DateTimePanel } from './datetime-panel';
import { Clock, Mail, Phone, MapPin, Building2, Shield, Settings, Bell, Trash2, LogIn, LogOut, Coffee, CheckCheck, X } from 'lucide-react';
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
  department?: string;
  phone?: string;
  dob?: string;
  address?: string;
  level?: string;
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
  const [showEditPunchModal, setShowEditPunchModal] = useState(false);
  const [editingPunch, setEditingPunch] = useState<Punch | null>(null);
  const [editPunchForm, setEditPunchForm] = useState({ clockIn: '', clockOut: '' });
  const [editPunchSaving, setEditPunchSaving] = useState(false);

  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [publishLoading, setPublishLoading] = useState(false);

  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    name: '', email: '', phone: '', dob: '', address: '', role: 'Server', department: 'Front of House', hourlyRate: 16, level: 'Employee'
  });
  const [editEmployeeSaving, setEditEmployeeSaving] = useState(false);
  const [editEmployeeMessage, setEditEmployeeMessage] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordMessage, setResetPasswordMessage] = useState<string | null>(null);
  const [resetPasswordSaving, setResetPasswordSaving] = useState(false);

  // Create shift form state
  const [newShift, setNewShift] = useState({
    employee: '',
    role: '',
    startTime: '',
    endTime: '',
    date: ''
  });

  const swapRequests = requests.filter((r) => r.status === 'pending');

  const normalizeId = (v: unknown) => {
    if (v == null) return '';
    if (typeof v === 'object' && v !== null && '$oid' in (v as Record<string, unknown>)) return String((v as { $oid: string }).$oid);
    return String(v);
  };

  const managerEmployee = useMemo(() => {
    const email = (user.email || '').toLowerCase();
    return employees.find((e) => {
      const empEmail = (e.email || '').toLowerCase();
      if (email && empEmail && empEmail === email) return true;
      return normalizeId((e as any).userId) === normalizeId(user.id);
    });
  }, [employees, user.email, user.id]);

  const managerPunch = useMemo(() => {
    const uid = normalizeId(user.id);
    const empId = managerEmployee?._id != null ? normalizeId(managerEmployee._id) : '';
    return punches.find((p) => {
      if (p.clockOut) return false;
      const pid = normalizeId(p.employeeId);
      return pid === uid || (empId && pid === empId);
    });
  }, [punches, user.id, managerEmployee]);

  /** Must match the id stored on the open punch, or else clock-out fails after employees load (user.id vs employee._id mismatch). */
  const managerPunchEmployeeId = managerPunch ? normalizeId(managerPunch.employeeId) : normalizeId(managerEmployee?._id || user.id);

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

  const handleCreateShift = async () => {
    const { employee, role, startTime, endTime, date } = newShift;
    const duration = calculateShiftDurationHours(startTime, endTime);

    if (!employee || !role || !startTime || !endTime || !date || duration <= 0) {
      setConfirmationMessage('Please complete all fields and ensure end time is after start time.');
      setTimeout(() => setConfirmationMessage(null), 3000);
      return;
    }

    const emp = employees.find(e => e.name === employee);
    try {
      const created = await api.createShift({ ...newShift, employeeId: emp?._id, durationHours: duration }, user.token);
      setShifts(prev => [...prev, created as Shift]);
      setNewShift({ employee: '', role: '', startTime: '', endTime: '', date: '' });
      setShowCreateShiftModal(false);
      setConfirmationMessage('Shift created successfully.');
    } catch (err: any) {
      setConfirmationMessage(err.message || 'Failed to create shift.');
    }
    setTimeout(() => setConfirmationMessage(null), 3000);
  };

  const handleDaySchedule = (day: string, date: string, weekLabel: string) => {
    setSelectedDay({ date, day, weekLabel });
    setShowDayScheduleModal(true);
  };

  const handleRemoveEmployee = async (employeeId: string, employeeName: string) => {
    try {
      await api.deleteEmployee(employeeId, user.token);
      setEmployees(employees.filter(emp => emp._id !== employeeId));
      setConfirmationMessage(`${employeeName} has been removed from the team.`);
    } catch (err: any) {
      setConfirmationMessage(err.message || 'Failed to remove employee.');
    }
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

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditEmployeeForm({
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      dob: emp.dob || '',
      address: emp.address || '',
      role: emp.role || 'Server',
      department: emp.department || 'Front of House',
      hourlyRate: emp.hourlyRate ?? 16,
      level: emp.level || 'Employee',
    });
    setEditEmployeeMessage(null);
    setResetPasswordValue('');
    setResetPasswordMessage(null);
    setShowEditEmployeeModal(true);
  };

  const handleSaveEditEmployee = async () => {
    if (!editingEmployee) return;
    setEditEmployeeSaving(true);
    setEditEmployeeMessage(null);
    try {
      await api.updateEmployee(editingEmployee._id, {
        name: editEmployeeForm.name,
        email: editEmployeeForm.email,
        phone: editEmployeeForm.phone,
        dob: editEmployeeForm.dob,
        address: editEmployeeForm.address,
        role: editEmployeeForm.role,
        department: editEmployeeForm.department,
        hourlyRate: Number(editEmployeeForm.hourlyRate),
        level: editEmployeeForm.level,
      }, user.token);
      setEmployees(prev => prev.map(e =>
        e._id === editingEmployee._id
          ? { ...e, name: editEmployeeForm.name, email: editEmployeeForm.email, phone: editEmployeeForm.phone, dob: editEmployeeForm.dob, address: editEmployeeForm.address, role: editEmployeeForm.role, department: editEmployeeForm.department, hourlyRate: Number(editEmployeeForm.hourlyRate), level: editEmployeeForm.level }
          : e
      ));
      setEditEmployeeMessage('Employee updated successfully.');
    } catch (err: any) {
      setEditEmployeeMessage(err.message || 'Failed to update employee.');
    }
    setEditEmployeeSaving(false);
  };

  const handleResetEmployeePassword = async () => {
    if (!editingEmployee) return;
    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      setResetPasswordMessage('Password must be at least 6 characters.');
      return;
    }
    setResetPasswordSaving(true);
    setResetPasswordMessage(null);
    try {
      await api.resetEmployeePassword(editingEmployee._id, resetPasswordValue, user.token);
      setResetPasswordMessage('Password has been reset. Employee will be notified.');
      setResetPasswordValue('');
    } catch (err: any) {
      setResetPasswordMessage(err.message || 'Failed to reset password.');
    }
    setResetPasswordSaving(false);
  };

  const week1StartIso = toISODate(week1Start);
  const week2EndIso = toISODate(week2End);

  const handleEditPunch = (punch: Punch) => {
    setEditingPunch(punch);
    const inDate = new Date(punch.clockIn);
    const formatLocalDatetime = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:${min}`;
    };
    setEditPunchForm({
      clockIn: formatLocalDatetime(inDate),
      clockOut: punch.clockOut ? formatLocalDatetime(new Date(punch.clockOut)) : '',
    });
    setShowEditPunchModal(true);
  };

  const handleSaveEditPunch = async () => {
    if (!editingPunch) return;
    setEditPunchSaving(true);
    try {
      const data: any = {};
      if (editPunchForm.clockIn) data.clockIn = new Date(editPunchForm.clockIn).toISOString();
      if (editPunchForm.clockOut) data.clockOut = new Date(editPunchForm.clockOut).toISOString();
      else data.clockOut = null;
      await api.updatePunch(editingPunch._id, data, user.token);
      const p = await api.getPunches({}, user.token);
      setPunches(p as Punch[]);
      setShowEditPunchModal(false);
      setEditingPunch(null);
      setConfirmationMessage('Punch record updated.');
    } catch (e: any) {
      setConfirmationMessage(e.message || 'Failed to update punch');
    } finally {
      setEditPunchSaving(false);
      setTimeout(() => setConfirmationMessage(null), 3000);
    }
  };

  const handlePublishScheduleReal = async () => {
    setPublishLoading(true);
    try {
      const result = await api.publishSchedule({ start: week1StartIso, end: week2EndIso }, user.token);
      setConfirmationMessage(`Schedule published! ${result.count} shifts notified to employees.`);
      setShowPublishModal(false);
    } catch (e: any) {
      setConfirmationMessage(e.message || 'Failed to publish schedule');
    } finally {
      setPublishLoading(false);
      setTimeout(() => setConfirmationMessage(null), 5000);
    }
  };

  const handlePrintSchedule = () => {
    const printShifts = shifts.filter(s => {
      const d = (s.date || '').split('T')[0];
      return d >= week1StartIso && d <= week2EndIso;
    });
    const grouped: Record<string, Shift[]> = {};
    printShifts.forEach(s => {
      const d = (s.date || '').split('T')[0];
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(s);
    });
    const sortedDates = Object.keys(grouped).sort();
    const rows = sortedDates.map(date => {
      const dayShifts = grouped[date];
      return `<tr><td colspan="4" style="background:#f0f4ff;font-weight:600;padding:8px 12px;border:1px solid #ddd">${new Date(date + 'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric'})}</td></tr>` +
        dayShifts.map(s => `<tr><td style="padding:6px 12px;border:1px solid #eee">${s.employee}</td><td style="padding:6px 12px;border:1px solid #eee">${s.role}</td><td style="padding:6px 12px;border:1px solid #eee">${s.startTime} – ${s.endTime}</td><td style="padding:6px 12px;border:1px solid #eee">${formatHours(calculateShiftDurationHours(s.startTime, s.endTime))}h</td></tr>`).join('');
    }).join('');
    const html = `<html><head><title>Shiftora Schedule</title><style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th{background:#2563eb;color:#fff;padding:10px 12px;text-align:left}h1{color:#2563eb;margin-bottom:4px}p{color:#666;margin-top:0}</style></head><body><h1>Shiftora Schedule</h1><p>${formatMonthDay(biWeeklyStart)} – ${formatMonthDay(biWeeklyEnd)}</p><table><thead><tr><th>Employee</th><th>Role</th><th>Time</th><th>Duration</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:20px;color:#999;font-size:12px">Printed on ${new Date().toLocaleString()}</p></body></html>`;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 400);
    }
  };

  const loadNotifications = useCallback(async () => {
    try {
      const notifs = await api.getUserNotifications(user.token);
      setUserNotifications(notifs);
    } catch {}
  }, [user.token]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead(user.token);
      setUserNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const handleExportPunchesCSV = () => {
    const sorted = [...punches].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
    const header = 'Employee,Punch In,Punch Out,Duration (min),Breaks\n';
    const rows = sorted.map(p => {
      const pIn = new Date(p.clockIn);
      const pOut = p.clockOut ? new Date(p.clockOut) : null;
      const dur = pOut ? Math.round((pOut.getTime() - pIn.getTime()) / 60000) : '';
      const breaks = (p.breaks || []).map((b: any) => {
        const s = new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const e = b.end ? new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'active';
        return `${s}-${e}`;
      }).join('; ');
      return `"${p.employeeName}","${pIn.toLocaleString()}","${pOut ? pOut.toLocaleString() : '—'}","${dur}","${breaks}"`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `shiftora-punches-${todayIso}.csv`; a.click();
    URL.revokeObjectURL(url);
    setConfirmationMessage('Punch records exported as CSV.');
    setTimeout(() => setConfirmationMessage(null), 3000);
  };

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
    loadNotifications();

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
      } catch {}
    }, 5000);

    const notifInterval = setInterval(loadNotifications, 15000);

    return () => { clearInterval(interval); clearInterval(notifInterval); };
  }, [user.token, week1StartIso, week2EndIso, todayIso, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', backgroundColor: showNotifDropdown ? '#e5e7eb' : '#f3f4f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseLeave={e => { if (!showNotifDropdown) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
              >
                <Bell style={{ width: 18, height: 18, color: '#374151' }} />
                {userNotifications.filter(n => !n.read).length > 0 && (
                  <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', border: '2px solid #fff' }}>
                    {userNotifications.filter(n => !n.read).length > 9 ? '9+' : userNotifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              {showNotifDropdown && (
                <div style={{ position: 'absolute', right: 0, top: 48, width: 380, backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 20px 60px -15px rgba(0,0,0,0.25)', border: '1px solid #e5e7eb', zIndex: 50, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontWeight: 600, color: '#111827', fontSize: 15, margin: 0 }}>Notifications</h3>
                    {userNotifications.filter(n => !n.read).length > 0 && (
                      <button onClick={handleMarkAllRead} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                        <CheckCheck style={{ width: 14, height: 14 }} /> Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {userNotifications.length === 0 ? (
                      <div style={{ padding: '48px 0', textAlign: 'center' }}>
                        <Bell style={{ width: 36, height: 36, color: '#d1d5db', margin: '0 auto 10px' }} />
                        <p style={{ color: '#9ca3af', fontSize: 14 }}>No notifications yet</p>
                      </div>
                    ) : (
                      userNotifications.slice(0, 20).map((notif) => {
                        const typeIcons: Record<string, { bg: string; color: string; label: string }> = {
                          new_request: { bg: '#fef3c7', color: '#d97706', label: 'Request' },
                          shift_assigned: { bg: '#dbeafe', color: '#2563eb', label: 'Shift' },
                          schedule_published: { bg: '#dcfce7', color: '#16a34a', label: 'Schedule' },
                          punch_edited: { bg: '#fae8ff', color: '#9333ea', label: 'Punch' },
                          request_approved: { bg: '#dcfce7', color: '#16a34a', label: 'Approved' },
                          request_declined: { bg: '#fef2f2', color: '#dc2626', label: 'Declined' },
                        };
                        const meta = typeIcons[notif.type] || { bg: '#f3f4f6', color: '#6b7280', label: 'Info' };
                        return (
                          <div
                            key={notif._id}
                            style={{ padding: '14px 18px', cursor: 'pointer', transition: 'background-color 0.15s', backgroundColor: notif.read ? '#fff' : '#eff6ff', borderBottom: '1px solid #f9fafb' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = notif.read ? '#fff' : '#eff6ff'}
                            onClick={async () => {
                              if (!notif.read) {
                                await api.markNotificationRead(notif._id, user.token);
                                setUserNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, read: true } : n));
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, backgroundColor: meta.bg, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0, marginTop: 2 }}>
                                {meta.label}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: '#1f2937', fontSize: 13, lineHeight: 1.5, margin: 0 }}>{notif.message}</p>
                                <p style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>
                                  {new Date(notif.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {!notif.read && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2563eb', flexShrink: 0, marginTop: 6 }} />}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
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
              <div style={{ width: 56, height: 56, minWidth: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', backgroundColor: managerPunchStatus === 'working' ? '#059669' : managerPunchStatus === 'break' ? '#d97706' : '#ea580c' }}>
                {managerPunchStatus === 'working' ? <Clock style={{ width: 28, height: 28, color: '#fff' }} /> : managerPunchStatus === 'break' ? <Coffee style={{ width: 28, height: 28, color: '#fff' }} /> : <LogIn style={{ width: 28, height: 28, color: '#fff' }} />}
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
                      await api.clockIn({ employeeId: managerPunchEmployeeId }, user.token);
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
                        await api.breakStart({ employeeId: managerPunchEmployeeId }, user.token);
                        const p = await api.getPunches({}, user.token);
                        setPunches(p as Punch[]);
                      } catch (e: any) {
                        setConfirmationMessage(e.message || 'Failed to start break');
                        setTimeout(() => setConfirmationMessage(null), 3000);
                      }
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
                        await api.clockOut({ employeeId: managerPunchEmployeeId }, user.token);
                        const p = await api.getPunches({}, user.token);
                        setPunches(p as Punch[]);
                      } catch (e: any) {
                        setConfirmationMessage(e.message || 'Failed to punch out');
                        setTimeout(() => setConfirmationMessage(null), 3000);
                      }
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
                      await api.breakEnd({ employeeId: managerPunchEmployeeId }, user.token);
                      const p = await api.getPunches({}, user.token);
                      setPunches(p as Punch[]);
                    } catch (e: any) {
                      setConfirmationMessage(e.message || 'Failed to end break');
                      setTimeout(() => setConfirmationMessage(null), 3000);
                    }
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl">Time Punches</h2>
              <p className="text-xs text-gray-500 mt-1">All punch in/out and break records</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs" onClick={handleExportPunchesCSV}>
                <Download className="w-3.5 h-3.5 mr-1" /> Print CSV
              </Button>
              <Badge variant="secondary" className="rounded-full">{punches.length} records</Badge>
            </div>
          </div>

          <div className="space-y-3">
            {[...punches].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()).slice(0, 4).map((punch) => {
              const punchInTime = new Date(punch.clockIn);
              const punchOutTime = punch.clockOut ? new Date(punch.clockOut) : null;
              const duration = punchOutTime ? Math.round((punchOutTime.getTime() - punchInTime.getTime()) / 60000) : null;
              return (
                <div key={punch._id} className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 bg-gray-50/50 flex flex-wrap items-center gap-4 group">
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
                  <button
                    onClick={() => handleEditPunch(punch)}
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-all"
                    title="Edit punch times"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
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
      {confirmationMessage && (() => {
        const isError = confirmationMessage.toLowerCase().includes('fail') || confirmationMessage.toLowerCase().includes('error') || confirmationMessage.toLowerCase().includes('invalid') || confirmationMessage.toLowerCase().includes('missing') || confirmationMessage.toLowerCase().includes('required');
        return (
          <div className={`fixed bottom-8 right-8 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50`} style={{ backgroundColor: isError ? '#ef4444' : '#22C55E' }}>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isError ? 'M6 18L18 6M6 6l12 12' : 'M5 13l4 4L19 7'} />
              </svg>
            </div>
            <span>{confirmationMessage}</span>
          </div>
        );
      })()}

      {/* Shifts Today Modal */}
      {showShiftsModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', overflowY: 'auto', padding: '32px 0' }}
          onClick={() => setShowShiftsModal(false)}
        >
          <div
            style={{ width: '100%', maxWidth: 960, margin: '0 24px', backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)', borderRadius: '16px 16px 0 0', padding: '24px 32px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>Shifts Today</h2>
                    <p style={{ fontSize: 14, marginTop: 2, color: 'rgba(255,255,255,0.7)' }}>{todayLabel} &middot; {todaysShifts.length} shift{todaysShifts.length !== 1 ? 's' : ''} scheduled</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 8 }}>
                    <div style={{ textAlign: 'center', padding: '6px 16px', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{todaysShifts.length}</div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.7)' }}>Shifts</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '6px 16px', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{liveEmployeeStatus.filter(e => e.status === 'working').length}</div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.7)' }}>Active</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowShiftsModal(false)}
                    style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 32 }}>
              {todaysShifts.length === 0 ? (
                <div style={{ padding: '64px 0', textAlign: 'center' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Calendar style={{ width: 40, height: 40, color: '#d1d5db' }} />
                  </div>
                  <p style={{ color: '#6b7280', fontWeight: 600, fontSize: 20 }}>No shifts scheduled today</p>
                  <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 8 }}>Add shifts through the schedule builder to see them here</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
                  {todaysShifts.map((shift, index) => {
                    const duration = calculateShiftDurationHours(shift.startTime, shift.endTime);
                    const statusEmp = liveEmployeeStatus.find(e => e.name === shift.employee);
                    const isWorking = statusEmp?.status === 'working';
                    const isOnBreak = statusEmp?.status === 'break';
                    const roleColorMap: Record<string, { bg: string; light: string; border: string }> = {
                      Server: { bg: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe' },
                      Bartender: { bg: '#ea580c', light: '#fff7ed', border: '#fed7aa' },
                      Chef: { bg: '#dc2626', light: '#fef2f2', border: '#fecaca' },
                      Manager: { bg: '#2563eb', light: '#eff6ff', border: '#bfdbfe' },
                    };
                    const colors = roleColorMap[shift.role] || { bg: '#6b7280', light: '#f9fafb', border: '#e5e7eb' };
                    const cardBg = isWorking ? '#f0fdf4' : isOnBreak ? '#fffbeb' : colors.light;
                    const cardBorder = isWorking ? '#bbf7d0' : isOnBreak ? '#fde68a' : colors.border;

                    return (
                      <div
                        key={index}
                        style={{ borderRadius: 16, overflow: 'hidden', border: `2px solid ${cardBorder}`, backgroundColor: cardBg, transition: 'box-shadow 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                      >
                        {/* Colored accent bar */}
                        <div style={{ height: 5, backgroundColor: isWorking ? '#22c55e' : isOnBreak ? '#f59e0b' : colors.bg }} />

                        <div style={{ padding: 24 }}>
                          {/* Employee info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                              {shift.employee.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: '#111827', fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shift.employee}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, padding: '3px 10px', borderRadius: 999, color: '#fff', fontWeight: 600, backgroundColor: colors.bg }}>
                                  {shift.role}
                                </span>
                                {isWorking && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '3px 10px', borderRadius: 999, fontWeight: 600, backgroundColor: '#dcfce7', color: '#166534' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse 2s infinite' }} />
                                    Active
                                  </span>
                                )}
                                {isOnBreak && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '3px 10px', borderRadius: 999, fontWeight: 600, backgroundColor: '#fef3c7', color: '#92400e' }}>
                                    <Coffee style={{ width: 12, height: 12 }} />
                                    On Break
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Schedule bar */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, padding: '14px 18px', backgroundColor: 'rgba(0,0,0,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Clock style={{ width: 18, height: 18, color: '#9ca3af' }} />
                              <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#1f2937', fontSize: 16 }}>{shift.startTime}</span>
                              <span style={{ color: '#9ca3af', fontSize: 16 }}>→</span>
                              <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#1f2937', fontSize: 16 }}>{shift.endTime}</span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, padding: '4px 14px', borderRadius: 10, backgroundColor: colors.bg + '18', color: colors.bg }}>
                              {formatHours(duration)}h
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                  <div key={employee._id || index} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between group hover:border-blue-300 transition-colors cursor-pointer" onClick={() => openEditEmployee(employee)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-sm">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-sm text-gray-600">{employee.role}{employee.department ? ` · ${employee.department}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {employee.hourlyRate != null && (
                        <span className="text-sm text-gray-500 font-medium">${employee.hourlyRate}/hr</span>
                      )}
                      <Badge className="bg-[#22C55E] hover:bg-[#22C55E]">Active</Badge>
                      <Pencil className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                        onClick={(e) => { e.stopPropagation(); handleRemoveEmployee(employee._id, employee.name); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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

      {/* Edit Employee Modal */}
      {showEditEmployeeModal && editingEmployee && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowEditEmployeeModal(false)} />
          <div style={{ position: 'relative', backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', padding: 0, boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>
                    {editingEmployee.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Edit Employee</h2>
                    <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>{editingEmployee.name} · {editingEmployee.role}</p>
                  </div>
                </div>
                <button onClick={() => setShowEditEmployeeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
                  <X style={{ width: 20, height: 20, color: '#9ca3af' }} />
                </button>
              </div>
            </div>

            <div style={{ padding: '24px 32px 32px' }}>
              {editEmployeeMessage && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14, backgroundColor: editEmployeeMessage.includes('success') ? '#f0fdf4' : '#fef2f2', color: editEmployeeMessage.includes('success') ? '#166534' : '#991b1b', border: `1px solid ${editEmployeeMessage.includes('success') ? '#bbf7d0' : '#fecaca'}` }}>
                  {editEmployeeMessage}
                </div>
              )}

              {/* Personal Info */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users style={{ width: 16, height: 16, color: '#6b7280' }} />
                  Personal Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>Full Name</Label>
                    <Input value={editEmployeeForm.name} onChange={(e) => setEditEmployeeForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl h-10 mt-1" />
                  </div>
                  <div>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>Email</Label>
                    <Input type="email" value={editEmployeeForm.email} onChange={(e) => setEditEmployeeForm(f => ({ ...f, email: e.target.value }))} className="rounded-xl h-10 mt-1" />
                  </div>
                  <div>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>Phone</Label>
                    <Input value={editEmployeeForm.phone} onChange={(e) => setEditEmployeeForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl h-10 mt-1" placeholder="(123) 456-7890" />
                  </div>
                  <div>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>Date of Birth</Label>
                    <Input type="date" value={editEmployeeForm.dob} onChange={(e) => setEditEmployeeForm(f => ({ ...f, dob: e.target.value }))} className="rounded-xl h-10 mt-1" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>Address</Label>
                    <Input value={editEmployeeForm.address} onChange={(e) => setEditEmployeeForm(f => ({ ...f, address: e.target.value }))} className="rounded-xl h-10 mt-1" placeholder="123 Main St, City" />
                  </div>
                </div>
              </div>

              {/* Position & Pay */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 style={{ width: 16, height: 16, color: '#6b7280' }} />
                  Position & Pay
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>Role</Label>
                    <Select value={editEmployeeForm.role} onValueChange={(v) => setEditEmployeeForm(f => ({ ...f, role: v }))}>
                      <SelectTrigger className="rounded-xl h-10 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Server', 'Bartender', 'Chef', 'Manager', 'Host', 'Dishwasher', 'Line Cook'].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>Department</Label>
                    <Select value={editEmployeeForm.department} onValueChange={(v) => setEditEmployeeForm(f => ({ ...f, department: v }))}>
                      <SelectTrigger className="rounded-xl h-10 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Front of House', 'Kitchen', 'Bar', 'Management'].map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>Position Level</Label>
                    <Select value={editEmployeeForm.level} onValueChange={(v) => setEditEmployeeForm(f => ({ ...f, level: v }))}>
                      <SelectTrigger className="rounded-xl h-10 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Employee">Employee</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>Hourly Rate ($)</Label>
                    <Input type="number" min="0" step="0.50" value={editEmployeeForm.hourlyRate} onChange={(e) => setEditEmployeeForm(f => ({ ...f, hourlyRate: Number(e.target.value) }))} className="rounded-xl h-10 mt-1" />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                <Button variant="outline" className="flex-1 rounded-full h-11" onClick={() => setShowEditEmployeeModal(false)}>Cancel</Button>
                <Button className="flex-1 rounded-full h-11" style={{ backgroundColor: '#2563EB' }} onClick={handleSaveEditEmployee} disabled={editEmployeeSaving}>
                  {editEmployeeSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>

              {/* Password Reset Section */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield style={{ width: 16, height: 16, color: '#6b7280' }} />
                  Reset Password
                </h3>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                  Set a new password for this employee. They will be notified and must use the new password to sign in.
                </p>
                {resetPasswordMessage && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: 14, backgroundColor: resetPasswordMessage.includes('reset') ? '#f0fdf4' : '#fef2f2', color: resetPasswordMessage.includes('reset') ? '#166534' : '#991b1b', border: `1px solid ${resetPasswordMessage.includes('reset') ? '#bbf7d0' : '#fecaca'}` }}>
                    {resetPasswordMessage}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <Label style={{ fontSize: 13, color: '#6b7280' }}>New Password (min 6 chars)</Label>
                    <Input type="password" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} className="rounded-xl h-10 mt-1" placeholder="Enter new password" />
                  </div>
                  <Button className="rounded-full h-10 px-6" style={{ backgroundColor: '#dc2626' }} onClick={handleResetEmployeePassword} disabled={resetPasswordSaving}>
                    {resetPasswordSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8" onClick={() => setShowPublishModal(false)}>
          <div className="w-full max-w-2xl mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 py-6 text-white" style={{ background: 'linear-gradient(to right, #2563eb, #4f46e5)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Publish Schedule</h2>
                  <p className="text-sm mt-1" style={{ color: '#bfdbfe' }}>{formatMonthDay(biWeeklyStart)} – {formatMonthDay(biWeeklyEnd)}</p>
                </div>
                <button onClick={() => setShowPublishModal(false)} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-center">
                  <div className="text-3xl font-bold text-blue-700">
                    {shifts.filter(s => { const d = (s.date || '').split('T')[0]; return d >= week1StartIso && d <= week2EndIso; }).length}
                  </div>
                  <div className="text-sm text-blue-600 mt-1">Total Shifts</div>
                </div>
                <div className="p-4 rounded-2xl bg-green-50 border border-green-100 text-center">
                  <div className="text-3xl font-bold text-green-700">
                    {new Set(shifts.filter(s => { const d = (s.date || '').split('T')[0]; return d >= week1StartIso && d <= week2EndIso; }).map(s => s.employee)).size}
                  </div>
                  <div className="text-sm text-green-600 mt-1">Employees</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50 space-y-2">
                <div className="text-sm font-semibold text-gray-700">What happens when you publish:</div>
                <ul className="space-y-1.5 text-sm text-gray-600">
                  <li className="flex items-center gap-2"><Bell className="w-3.5 h-3.5 text-blue-500" /> All employees with shifts will be notified</li>
                  <li className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-purple-500" /> Admin will be notified about the publication</li>
                  <li className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-green-500" /> Shifts will be marked as published</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePrintSchedule}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-6 py-4 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Printer className="w-5 h-5" />
                  Print Schedule
                </button>
                <button
                  onClick={handlePublishScheduleReal}
                  disabled={publishLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl px-6 py-4 font-semibold text-white shadow-lg transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(to right, #2563eb, #4f46e5)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(to right, #1d4ed8, #4338ca)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #4f46e5)'}
                >
                  {publishLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
                  {publishLoading ? 'Publishing...' : 'Publish & Notify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs" onClick={handleExportPunchesCSV}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Print CSV
                </Button>
                <button
                  onClick={() => setShowAllPunchesModal(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
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
                          <button
                            onClick={() => { setShowAllPunchesModal(false); handleEditPunch(punch); }}
                            className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-all"
                            title="Edit punch times"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
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

      {/* Edit Punch Modal */}
      <Dialog open={showEditPunchModal} onOpenChange={setShowEditPunchModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Punch Record</DialogTitle>
            <DialogDescription>
              Fix punch in/out times for {editingPunch?.employeeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 mt-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {editingPunch?.employeeName?.slice(0, 2).toUpperCase() || '?'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{editingPunch?.employeeName}</div>
                <div className="text-xs text-gray-500">
                  Original: {editingPunch ? new Date(editingPunch.clockIn).toLocaleString() : ''}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Punch In Time</Label>
              <Input
                type="datetime-local"
                value={editPunchForm.clockIn}
                onChange={(e) => setEditPunchForm({ ...editPunchForm, clockIn: e.target.value })}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Punch Out Time (leave blank if still active)</Label>
              <Input
                type="datetime-local"
                value={editPunchForm.clockOut}
                onChange={(e) => setEditPunchForm({ ...editPunchForm, clockOut: e.target.value })}
                className="rounded-xl h-11"
              />
            </div>
            <p className="text-xs text-gray-400">The employee will be notified that their punch times were edited.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowEditPunchModal(false)}>Cancel</Button>
              <Button
                className="flex-1 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8]"
                onClick={handleSaveEditPunch}
                disabled={editPunchSaving}
              >
                {editPunchSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manager Profile Modal */}
      <Dialog open={showManagerProfile} onOpenChange={setShowManagerProfile}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Manager Profile</DialogTitle>
            <DialogDescription>View and manage your account information</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {managerProfileMessage && (
              <div className={`p-3 rounded-lg text-sm ${managerProfileMessage.toLowerCase().includes('updated') || managerProfileMessage.toLowerCase().includes('saved') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
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
