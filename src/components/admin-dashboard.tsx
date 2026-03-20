import { Users, DollarSign, Building2, Shield, Settings, ChevronRight, Trash2, Crown, ArrowUpCircle, ArrowDownCircle, Plus, Calendar, Clock, BarChart3, FileText, UserX, Search, Bell, Download, CheckCircle2, AlertTriangle, Info, Eye, Loader2, CheckCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { addDays, calculateShiftDurationHours, formatLongDate, startOfWeek, toISODate } from '../utils/time';
import { api } from '../api/client';
import type { Notification as AppNotification, Settings as AppSettings } from '../api/client';
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

type Shift = {
  _id?: string;
  employee: string;
  employeeId?: string;
  role: string;
  startTime: string;
  endTime: string;
  date: string;
  durationHours?: number;
};

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

export function AdminDashboard({ onNavigate, onLogout, user }: Props) {
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date();
  const todayIso = toISODate(today);
  const todayLabel = formatLongDate(today);
  const biWeeklyStart = startOfWeek(today);
  const week1End = addDays(biWeeklyStart, 6);
  const week1StartIso = toISODate(biWeeklyStart);
  const week1EndIso = toISODate(addDays(biWeeklyStart, 13));

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [tips, setTips] = useState<{ _id: string; amount: number; date: string; notes?: string }[]>([]);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [showEmployeeManagement, setShowEmployeeManagement] = useState(false);
  const [showFinancialReport, setShowFinancialReport] = useState(false);
  const [showAllPunchesModal, setShowAllPunchesModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsEditing, setSettingsEditing] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Partial<AppSettings>>({});

  const [attendancePunches, setAttendancePunches] = useState<Punch[]>([]);

  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', password: '', role: 'Server', department: 'Front of House', hourlyRate: 16 });
  const [adminProfile, setAdminProfile] = useState({ name: '', dob: '', address: '', phone: '' });
  const [adminProfileEditing, setAdminProfileEditing] = useState(false);
  const [adminPasswordForm, setAdminPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [adminProfileMessage, setAdminProfileMessage] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState('');
  const [tipNotes, setTipNotes] = useState('');

  const [finSelectedDate, setFinSelectedDate] = useState(todayIso);
  const [finDateReport, setFinDateReport] = useState<any>(null);
  const [finLoading, setFinLoading] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const getId = (emp: Employee) => emp._id || '';

  const liveEmployeeStatus = useMemo(() => employees.map((emp) => {
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
  }), [employees, punches]);

  const groupedByDepartment = useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    employees.forEach(e => {
      const dept = e.department || 'Other';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(e);
    });
    return groups;
  }, [employees]);

  const groupedByLevel = useMemo(() => ({
    Manager: employees.filter(e => e.level === 'Manager'),
    Employee: employees.filter(e => e.level !== 'Manager'),
  }), [employees]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const q = employeeSearch.toLowerCase();
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q)
    );
  }, [employees, employeeSearch]);

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
        const [empList, punchList, tipList, overview, shiftList] = await Promise.all([
          api.getEmployees(user.token),
          api.getPunches({}, user.token),
          api.getTips(todayIso, user.token),
          api.getOverviewReport(user.token),
          api.getShifts({ start: week1StartIso, end: week1EndIso }, user.token),
        ]);
        setEmployees(empList as Employee[]);
        setPunches(punchList as Punch[]);
        setTips(tipList as any[]);
        setShifts(shiftList as Shift[]);
        if (overview?.daily) setDailyReport(overview.daily);
        if (overview?.weekly) setWeeklyReport(overview.weekly);
      } catch (err: any) {
        showToast(err.message || 'Failed to load data.', 'error');
      }
    };
    load();
    const interval = setInterval(async () => {
      try {
        const [punchList, tipList, overview, notifs] = await Promise.all([
          api.getPunches({}, user.token),
          api.getTips(todayIso, user.token),
          api.getOverviewReport(user.token),
          api.getNotifications(user.token),
        ]);
        setPunches(punchList as Punch[]);
        setTips(tipList as any[]);
        if (overview?.daily) setDailyReport(overview.daily);
        if (overview?.weekly) setWeeklyReport(overview.weekly);
        setNotifications(notifs);
      } catch { /* polling */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [user.token, todayIso, week1StartIso, week1EndIso, showToast]);

  useEffect(() => {
    api.getNotifications(user.token).then(setNotifications).catch(() => {});
  }, [user.token]);

  const loadUserNotifications = useCallback(async () => {
    try {
      const notifs = await api.getUserNotifications(user.token);
      setUserNotifications(notifs);
    } catch {}
  }, [user.token]);

  useEffect(() => {
    loadUserNotifications();
    const interval = setInterval(loadUserNotifications, 15000);
    return () => clearInterval(interval);
  }, [loadUserNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePromote = async (employee: Employee) => {
    const isManager = employee.level === 'Manager';
    try {
      await api.updateEmployee(getId(employee), { level: isManager ? 'Employee' : 'Manager', role: isManager ? 'Server' : 'Manager' }, user.token);
      setEmployees(prev => prev.map(e => getId(e) === getId(employee) ? { ...e, level: isManager ? 'Employee' : 'Manager', role: isManager ? 'Server' : 'Manager' } : e));
      showToast(`${employee.name} has been ${isManager ? 'demoted to Employee' : 'promoted to Manager'}!`);
    } catch (err: any) { showToast(err.message || 'Failed to update role.', 'error'); }
    setShowPromoteModal(false); setSelectedEmployee(null);
  };

  const handleRemoveEmployee = async (employee: Employee) => {
    try {
      await api.deleteEmployee(getId(employee), user.token);
      setEmployees(prev => prev.filter(e => getId(e) !== getId(employee)));
      showToast(`${employee.name} has been removed.`);
    } catch (err: any) { showToast(err.message || 'Failed to remove employee.', 'error'); }
    setShowRemoveModal(false); setSelectedEmployee(null);
  };

  const handleAddEmployee = async () => {
    const { name, email, password, role, department, hourlyRate } = newEmployee;
    if (!name || !email) { showToast('Name and email are required.', 'error'); return; }
    if (!password || password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
    try {
      const created = await api.createEmployee({ name, email, password, role, department, level: role === 'Manager' ? 'Manager' : 'Employee', hourlyRate: Number(hourlyRate), status: 'active' }, user.token);
      setEmployees(prev => [...prev, created as Employee]);
      setNewEmployee({ name: '', email: '', password: '', role: 'Server', department: 'Front of House', hourlyRate: 16 });
      setShowAddEmployeeModal(false);
      showToast(`${name} has been added to the team!`);
    } catch (err: any) { showToast(err.message || 'Failed to add employee.', 'error'); }
  };

  const handleAddTip = async () => {
    const amount = parseFloat(tipAmount);
    if (Number.isNaN(amount) || amount <= 0) { showToast('Enter a valid tip amount.', 'error'); return; }
    try {
      const created = await api.createTip({ amount, date: todayIso, notes: tipNotes }, user.token);
      setTips([...tips, created]); setTipAmount(''); setTipNotes('');
      showToast('Tips pool updated.');
    } catch (err: any) { showToast(err.message || 'Failed to add tip.', 'error'); }
  };

  const handleBulkDepartmentChange = async (dept: string) => {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map(id => api.updateEmployee(id, { department: dept }, user.token)));
      setEmployees(prev => prev.map(e => selectedIds.has(getId(e)) ? { ...e, department: dept } : e));
      showToast(`${ids.length} employee(s) moved to ${dept}.`);
      setSelectedIds(new Set()); setShowBulkActions(false);
    } catch (err: any) { showToast(err.message || 'Bulk update failed.', 'error'); }
  };

  const handleExportCSV = () => {
    const header = 'Name,Email,Role,Department,Level,Hourly Rate,Status,Join Date\n';
    const rows = employees.map(e => `"${e.name}","${e.email}","${e.role}","${e.department}","${e.level}",${e.hourlyRate},"${e.status || 'active'}","${e.joinDate || ''}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `shiftora-employees-${todayIso}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('Employee list exported as CSV.', 'info');
  };

  const handleViewAttendance = async (emp: Employee) => {
    setSelectedEmployee(emp);
    try {
      const empPunches = await api.getPunches({ employeeId: emp._id }, user.token);
      setAttendancePunches(empPunches as Punch[]);
    } catch { setAttendancePunches([]); }
    setShowAttendanceModal(true);
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
    showToast('Punch records exported as CSV.', 'info');
  };

  const todaysShifts = useMemo(() =>
    shifts.filter(s => (s.date || '').split('T')[0] === todayIso),
    [shifts, todayIso]
  );

  const upcomingShifts = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return shifts
      .filter(s => {
        const d = (s.date || '').split('T')[0];
        return d > todayIso;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [shifts, todayIso, today]);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const handleLoadSettings = async () => {
    setShowSettingsModal(true);
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const s = await api.getSettings(user.token);
      setSettings(s);
      setSettingsForm(s);
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to load settings.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.updateSettings(settingsForm, user.token);
      setSettings(prev => prev ? { ...prev, ...settingsForm } : prev);
      showToast('Settings saved successfully.');
      setSettingsEditing(false);
    } catch (err: any) { showToast(err.message || 'Failed to save settings.', 'error'); }
  };

  const handleFetchFinancialDate = async () => {
    setFinLoading(true);
    try {
      const report = await api.getDailyReport(finSelectedDate, user.token);
      setFinDateReport(report);
    } catch {
      setFinDateReport(null);
      showToast('Failed to load report for selected date.', 'error');
    } finally {
      setFinLoading(false);
    }
  };

  const toggleBulkSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const deptStyles: Record<string, { card: string; icon: string; iconText: string; viewText: string }> = {
    'Front of House': {
      card: 'border-blue-200 bg-blue-50',
      icon: 'bg-blue-100',
      iconText: 'text-blue-600',
      viewText: 'text-blue-600',
    },
    'Kitchen': {
      card: 'border-red-200 bg-red-50',
      icon: 'bg-red-100',
      iconText: 'text-red-600',
      viewText: 'text-red-600',
    },
    'Bar': {
      card: 'border-purple-200 bg-purple-50',
      icon: 'bg-purple-100',
      iconText: 'text-purple-600',
      viewText: 'text-purple-600',
    },
    'Management': {
      card: 'border-amber-200 bg-amber-50',
      icon: 'bg-amber-100',
      iconText: 'text-amber-600',
      viewText: 'text-amber-600',
    },
  };
  const defaultDeptStyle = {
    card: 'border-gray-200 bg-gray-50',
    icon: 'bg-gray-100',
    iconText: 'text-gray-600',
    viewText: 'text-gray-600',
  };

  return (
    <div className="min-h-screen">
      {/* Navbar — matches manager/employee pattern */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl tracking-tight">
                <span className="font-semibold text-[#2563EB]">Shift</span><span className="text-black">ora</span>
              </span>
            </div>
            <Badge variant="secondary" className="rounded-full">Admin</Badge>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <button className="text-gray-900 font-medium">Dashboard</button>
            <button onClick={() => onNavigate('wages')} className="text-gray-600 hover:text-gray-900 transition-colors">Wages & Tips</button>
          </div>

          <div className="flex items-center gap-3">
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', backgroundColor: showNotifDropdown ? '#e5e7eb' : '#f3f4f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseLeave={e => { if (!showNotifDropdown) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
              >
                <Bell style={{ width: 18, height: 18, color: '#374151' }} />
                {(userNotifications.filter(n => !n.read).length + notifications.length) > 0 && (
                  <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', border: '2px solid #fff' }}>
                    {(userNotifications.filter(n => !n.read).length + notifications.length) > 9 ? '9+' : userNotifications.filter(n => !n.read).length + notifications.length}
                  </span>
                )}
              </button>
              {showNotifDropdown && (
                <div style={{ position: 'absolute', right: 0, top: 48, width: 380, backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 20px 60px -15px rgba(0,0,0,0.25)', border: '1px solid #e5e7eb', zIndex: 50, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontWeight: 600, color: '#111827', fontSize: 15, margin: 0 }}>Notifications</h3>
                    {userNotifications.filter(n => !n.read).length > 0 && (
                      <button onClick={async () => {
                        await api.markAllNotificationsRead(user.token);
                        setUserNotifications(prev => prev.map(n => ({ ...n, read: true })));
                      }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                        <CheckCheck style={{ width: 14, height: 14 }} /> Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifications.map((n, i) => (
                      <div key={`sys-${i}`} style={{ padding: '14px 18px', backgroundColor: '#fffbeb', borderBottom: '1px solid #f9fafb' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, backgroundColor: '#fef3c7', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0, marginTop: 2 }}>
                            Alert
                          </span>
                          <p style={{ color: '#1f2937', fontSize: 13, lineHeight: 1.5, margin: 0 }}>{n.message}</p>
                        </div>
                      </div>
                    ))}
                    {userNotifications.length === 0 && notifications.length === 0 ? (
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
            <DateTimePanel />
            <button
              onClick={() => setShowAdminProfile(true)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
            >
              {(user.name || 'A')[0].toUpperCase()}
            </button>
            <Button variant="ghost" onClick={onLogout} className="hidden sm:inline-flex">Log out</Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl">{greeting}, {user.name || 'Admin'}.</h1>
          <p className="text-gray-600">Full oversight and control of your restaurant operations.</p>
        </div>

        {/* Hero Stats Row */}
        <div className="grid md:grid-cols-4 gap-6">
          <button onClick={() => setShowEmployeeManagement(true)} className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 hover:border-blue-200 transition-all text-left cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-3xl font-bold">{employees.length}</span>
            </div>
            <div className="text-gray-600">Total Staff</div>
            <div className="text-sm text-[#2563EB] mt-2">Manage →</div>
          </button>

          <button onClick={() => setShowFinancialReport(true)} className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 hover:border-green-200 transition-all text-left cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-3xl font-bold">${(dailyReport?.totalWages ?? 0).toFixed(0)}</span>
            </div>
            <div className="text-gray-600">Today&apos;s wages</div>
            <div className="text-sm text-[#22C55E] mt-2">View report →</div>
          </button>

          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-3xl font-bold">${(dailyReport?.totalTips ?? 0).toFixed(0)}</span>
            </div>
            <div className="text-gray-600">Today&apos;s tips</div>
            <div className="text-sm text-purple-600 mt-2">Proportional split</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-3xl font-bold">{(dailyReport?.totalHours ?? 0).toFixed(0)}h</span>
            </div>
            <div className="text-gray-600">Hours logged</div>
            <div className="text-sm text-amber-600 mt-2">{todayLabel.split(',')[0]}</div>
          </div>
        </div>

        {/* Two Column: Live Status + Quick Actions */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Live Employee Status */}
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Live status</h2>
                <p className="text-xs text-gray-500 mt-1">Who&apos;s on the clock right now</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                  <span className="text-xs text-gray-600">{workingCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs text-gray-600">{breakCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <span className="text-xs text-gray-600">{offCount}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {liveEmployeeStatus.map((emp, idx) => (
                <div
                  key={idx}
                  onClick={() => handleViewAttendance(emp as any)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-sm ${
                    emp.status === 'working'
                      ? 'border-green-200 bg-green-50'
                      : emp.status === 'break'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                      emp.status === 'working'
                        ? 'bg-gradient-to-br from-green-400 to-green-600'
                        : emp.status === 'break'
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                        : 'bg-gradient-to-br from-gray-400 to-gray-600'
                    }`}>
                      {emp.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{emp.name}</div>
                      <div className="text-xs text-gray-600">{emp.role}</div>
                    </div>
                    <Badge className={`${
                      emp.status === 'working'
                        ? 'bg-[#22C55E] hover:bg-[#22C55E]'
                        : emp.status === 'break'
                        ? 'bg-amber-500 hover:bg-amber-500'
                        : 'bg-gray-500 hover:bg-gray-500'
                    }`}>
                      {emp.status === 'working' ? 'Working' : emp.status === 'break' ? 'Break' : 'Off'}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    {emp.status !== 'punched_out' && (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-600">Punched in: {emp.punchInTime}</span>
                      </div>
                    )}
                    {emp.status === 'break' && emp.breakStart && (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-600">Break started: {emp.breakStart}</span>
                      </div>
                    )}
                    {emp.status !== 'punched_out' && (
                      <div className={`text-xs font-medium ${
                        emp.status === 'working' ? 'text-green-700' : 'text-amber-700'
                      }`}>
                        {emp.currentDuration}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {employees.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600">
                  No employees yet. Add your first team member.
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions + Tips Pool */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
              <h2 className="text-xl font-semibold mb-2">Quick actions</h2>
              <div className="space-y-3">
                <Button className="w-full justify-start rounded-xl h-12 bg-[#2563EB] hover:bg-[#1d4ed8]" onClick={() => setShowAddEmployeeModal(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add new employee
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl h-12" onClick={() => setShowEmployeeManagement(true)}>
                  <Users className="w-4 h-4 mr-2" /> Manage employees
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl h-12" onClick={() => setShowFinancialReport(true)}>
                  <FileText className="w-4 h-4 mr-2" /> Financial reports
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl h-12" onClick={() => onNavigate('wages')}>
                  <DollarSign className="w-4 h-4 mr-2" /> Wages & tips report
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl h-12" onClick={handleLoadSettings}>
                  <Settings className="w-4 h-4 mr-2" /> System settings
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl h-12" onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-2" /> Export employees CSV
                </Button>
              </div>
            </div>

            {/* Tips Pool */}
            <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
              <h2 className="text-xl font-semibold">Tips pool (today)</h2>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Input type="number" min="0" placeholder="Amount" value={tipAmount} onChange={e => setTipAmount(e.target.value)} className="rounded-xl" />
                  <Button className="rounded-xl bg-[#2563EB]" onClick={handleAddTip}>Add</Button>
                </div>
                <Input placeholder="Notes (optional)" value={tipNotes} onChange={e => setTipNotes(e.target.value)} className="rounded-xl" />
                <div className="text-sm text-gray-600">
                  {tips.filter(t => t.date === todayIso).length} entries &bull; ${tips.filter(t => t.date === todayIso).reduce((s, t) => s + Number(t.amount || 0), 0).toFixed(2)}
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {tips.filter(t => t.date === todayIso).slice(-5).reverse().map(tip => (
                    <div key={tip._id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                      <span>${Number(tip.amount).toFixed(2)}</span>
                      <span className="text-gray-500">{tip.notes || 'No notes'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Departments + Today's Shifts — side by side */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Departments (compact) */}
          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Departments</h2>
              <span className="text-xs text-gray-500">{Object.keys(groupedByDepartment).length} depts &bull; {employees.length} staff</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(groupedByDepartment).map(([dept, emps]) => {
                const ds = deptStyles[dept] || defaultDeptStyle;
                const managers = emps.filter(e => e.level === 'Manager');
                return (
                  <button
                    key={dept}
                    onClick={() => { setSelectedDepartment(dept); setShowDepartmentModal(true); }}
                    className={`rounded-xl p-3 border text-left transition-all hover:shadow-sm ${ds.card}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-7 h-7 rounded-lg ${ds.icon} flex items-center justify-center`}>
                        <Building2 className={`w-3.5 h-3.5 ${ds.iconText}`} />
                      </div>
                      <span className="text-xl font-bold">{emps.length}</span>
                    </div>
                    <div className="text-sm font-medium">{dept}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {managers.length > 0 ? `${managers.map(m => m.name.split(' ')[0]).join(', ')} — Mgr` : 'No manager'}
                    </div>
                    <div className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${ds.viewText}`}>
                      <Eye className="w-3 h-3" /> View
                    </div>
                  </button>
                );
              })}
              {Object.keys(groupedByDepartment).length === 0 && (
                <div className="col-span-2 p-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600">
                  No departments yet.
                </div>
              )}
            </div>
          </div>

          {/* Today's Shifts & Upcoming */}
          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Today&apos;s shifts</h2>
              <button
                onClick={() => setShowShiftsModal(true)}
                className="text-xs text-[#2563EB] font-medium hover:underline"
              >
                View all →
              </button>
            </div>

            {todaysShifts.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 text-center">
                No shifts scheduled for today.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {todaysShifts.map((shift, idx) => {
                  const dur = calculateShiftDurationHours(shift.startTime, shift.endTime);
                  return (
                    <div key={shift._id || idx} className="p-3 rounded-xl border border-blue-100 bg-blue-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          {shift.employee?.split(' ').map(n => n[0]).join('') || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{shift.employee}</div>
                          <div className="text-xs text-gray-500">{shift.role}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium tabular-nums">{shift.startTime} – {shift.endTime}</div>
                        <div className="text-xs text-gray-500">{dur.toFixed(1)}h</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {upcomingShifts.length > 0 && (
              <>
                <div className="border-t border-gray-100 pt-3">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Upcoming shifts</h3>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {upcomingShifts.map((shift, idx) => {
                    const shiftDate = new Date(shift.date + 'T00:00:00');
                    return (
                      <div key={shift._id || idx} className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-white text-xs font-bold">
                            {shift.employee?.split(' ').map(n => n[0]).join('') || '?'}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{shift.employee}</div>
                            <div className="text-xs text-gray-500">{shift.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium tabular-nums">{shift.startTime} – {shift.endTime}</div>
                          <div className="text-xs text-gray-400">{shiftDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent Punches */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-semibold">Recent punches</h2>
              <p className="text-xs text-gray-500 mt-1">{punches.length} total records — latest first</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={handleExportPunchesCSV}>
              <Download className="w-4 h-4 mr-1.5" /> Print CSV
            </Button>
          </div>

          {punches.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-dashed border-gray-200">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No punch records yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...punches].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()).slice(0, 4).map((punch) => {
                const pIn = new Date(punch.clockIn);
                const pOut = punch.clockOut ? new Date(punch.clockOut) : null;
                const dur = pOut ? Math.round((pOut.getTime() - pIn.getTime()) / 60000) : null;
                const isActive = !pOut;
                return (
                  <div key={punch._id} className={`rounded-xl border p-4 transition-colors ${isActive ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-gray-50/50 hover:bg-white'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${isActive ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                        {punch.employeeName?.slice(0, 2).toUpperCase() || '—'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{punch.employeeName}</div>
                        <div className="text-xs text-gray-500">{pIn.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      </div>
                      {isActive
                        ? <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-600 text-white">Active</span>
                        : dur != null && <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-200 text-gray-700">{Math.floor(dur / 60)}h {dur % 60}m</span>
                      }
                    </div>
                    <div className="grid grid-cols-3 gap-4 pl-12">
                      <div>
                        <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">In</div>
                        <div className="font-semibold tabular-nums text-emerald-700">{pIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Out</div>
                        <div className={`font-semibold tabular-nums ${pOut ? 'text-red-600' : 'text-amber-500'}`}>{pOut ? pOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Breaks</div>
                        <div className="text-sm font-medium text-gray-700">
                          {punch.breaks?.length
                            ? punch.breaks.map((b: any, i: number) => (
                                <span key={i} className="block text-xs leading-relaxed">
                                  {new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {b.end ? ` – ${new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (active)'}
                                </span>
                              ))
                            : <span className="text-gray-400">—</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {punches.length > 4 && (
            <button onClick={() => setShowAllPunchesModal(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-blue-200 text-[#2563EB] font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              See all {punches.length} records <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Financial Analytics */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold">Financial analytics</h2>
              <p className="text-xs text-gray-500 mt-1">Daily and weekly performance overview</p>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={finSelectedDate} onChange={e => setFinSelectedDate(e.target.value)} className="rounded-xl h-9 w-auto text-sm" />
              <Button size="sm" className="rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8]" onClick={handleFetchFinancialDate} disabled={finLoading}>
                {finLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look up'}
              </Button>
            </div>
          </div>

          {/* Today's summary (always visible) */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-700" />
                </div>
                <div className="text-sm text-gray-600">Today&apos;s wages</div>
              </div>
              <div className="text-3xl font-bold mb-1">${(dailyReport?.totalWages ?? 0).toFixed(2)}</div>
              <div className="text-sm text-gray-600">{(dailyReport?.totalHours ?? 0).toFixed(1)} hours worked</div>
            </div>

            <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-200 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-700" />
                </div>
                <div className="text-sm text-gray-600">Today&apos;s tips</div>
              </div>
              <div className="text-3xl font-bold mb-1">${(dailyReport?.totalTips ?? 0).toFixed(2)}</div>
              <div className="text-sm text-gray-600">Proportional split</div>
            </div>
          </div>

          {dailyReport?.employees?.length > 0 && (
            <div className="border-t border-gray-200 pt-6 space-y-3">
              <h3 className="font-semibold">Today&apos;s employee breakdown</h3>
              {dailyReport.employees.map((emp: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-xs">
                      {emp.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{emp.name}</div>
                      <div className="text-xs text-gray-500">{emp.role} &bull; {emp.hours}h @ ${emp.rate}/hr</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">${(emp.wages + emp.tips).toFixed(2)}</div>
                    <div className="text-xs text-gray-400">${emp.wages.toFixed(2)} + ${emp.tips.toFixed(2)} tips</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Date lookup results */}
          {finDateReport && finSelectedDate !== todayIso && (
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2563EB]" />
                Report for {formatLongDate(new Date(finSelectedDate + 'T00:00:00'))}
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl border border-green-200 bg-green-50">
                  <div className="text-sm text-gray-600 mb-2">Wages</div>
                  <div className="text-2xl font-bold text-green-700">${(finDateReport.totalWages ?? 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-1">{(finDateReport.totalHours ?? 0).toFixed(1)} hours</div>
                </div>
                <div className="p-5 rounded-xl border border-purple-200 bg-purple-50">
                  <div className="text-sm text-gray-600 mb-2">Tips</div>
                  <div className="text-2xl font-bold text-purple-700">${(finDateReport.totalTips ?? 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-1">Proportional split</div>
                </div>
                <div className="p-5 rounded-xl border border-blue-200 bg-blue-50">
                  <div className="text-sm text-gray-600 mb-2">Combined</div>
                  <div className="text-2xl font-bold text-blue-700">${((finDateReport.totalWages ?? 0) + (finDateReport.totalTips ?? 0)).toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-1">Total payout</div>
                </div>
              </div>
              {finDateReport.employees?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Employee breakdown</h4>
                  {finDateReport.employees.map((emp: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-xs">
                          {emp.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{emp.name}</div>
                          <div className="text-xs text-gray-500">{emp.hours}h @ ${emp.rate}/hr</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">${(emp.wages + emp.tips).toFixed(2)}</div>
                        <div className="text-xs text-gray-400">${emp.wages.toFixed(2)} + ${emp.tips.toFixed(2)} tips</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(!finDateReport.employees || finDateReport.employees.length === 0) && (
                <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 text-center">No employee records found for this date.</div>
              )}
            </div>
          )}
        </div>

        {/* Payroll Summary */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Payroll summary</h2>
            <Badge variant="secondary" className="rounded-full">This week</Badge>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-100">
              <div className="text-sm text-gray-600 mb-2">Total payroll</div>
              <div className="text-3xl font-bold text-amber-900">${((weeklyReport?.totalWages ?? 0) + (weeklyReport?.totalTips ?? 0)).toFixed(2)}</div>
              <div className="text-sm text-gray-500 mt-1">Wages + tips</div>
            </div>
            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100">
              <div className="text-sm text-gray-600 mb-2">Avg per employee</div>
              <div className="text-3xl font-bold text-blue-900">${employees.length > 0 ? (((weeklyReport?.totalWages ?? 0) + (weeklyReport?.totalTips ?? 0)) / employees.length).toFixed(2) : '0.00'}</div>
              <div className="text-sm text-gray-500 mt-1">{employees.length} staff members</div>
            </div>
            <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100">
              <div className="text-sm text-gray-600 mb-2">Avg hourly rate</div>
              <div className="text-3xl font-bold text-green-900">${employees.length > 0 ? (employees.reduce((s, e) => s + e.hourlyRate, 0) / employees.length).toFixed(2) : '0.00'}</div>
              <div className="text-sm text-gray-500 mt-1">Across all roles</div>
            </div>
          </div>
        </div>
      </main>

      {/* Toast — success green, error red, info blue */}
      {toast && (() => {
        const bg = toast.type === 'error' ? 'bg-red-500' : toast.type === 'info' ? 'bg-[#2563EB]' : 'bg-[#22C55E]';
        return (
          <div className={`fixed bottom-8 right-8 ${bg} text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50`}>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : toast.type === 'info' ? <Info className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
            <span>{toast.message}</span>
          </div>
        );
      })()}

      {/* All Punches Modal */}
      {showAllPunchesModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
          <div className="w-full max-w-4xl mx-4 bg-white rounded-2xl shadow-2xl">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 px-6 py-5 border-b border-gray-200 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">All Time Punches</h2>
                <p className="text-sm text-gray-500 mt-1">{punches.length} records — latest first</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={handleExportPunchesCSV}>
                  <Download className="w-4 h-4 mr-1.5" /> Print CSV
                </Button>
                <button onClick={() => setShowAllPunchesModal(false)} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors text-lg">✕</button>
              </div>
            </div>

            {/* Records */}
            <div className="p-6 space-y-3">
              {punches.length === 0 ? (
                <div className="py-16 text-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
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
                      <div key={punch._id} className={`rounded-xl border p-4 transition-colors ${isActive ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-gray-50/50 hover:bg-white'}`}>
                        {/* Row 1: Avatar + name + date + status badge */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isActive ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                            {punch.employeeName?.slice(0, 2).toUpperCase() || '—'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900">{punch.employeeName}</div>
                            <div className="text-xs text-gray-500">{pIn.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          </div>
                          {isActive
                            ? <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white">Active</span>
                            : dur != null && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">{Math.floor(dur / 60)}h {dur % 60}m</span>
                          }
                        </div>

                        {/* Row 2: Times grid */}
                        <div className="grid grid-cols-3 gap-4 pl-[52px]">
                          <div>
                            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Punch In</div>
                            <div className="font-semibold tabular-nums text-emerald-700">{pIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Punch Out</div>
                            <div className={`font-semibold tabular-nums ${pOut ? 'text-red-600' : 'text-amber-500'}`}>{pOut ? pOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Breaks</div>
                            <div className="text-sm font-medium text-gray-700">
                              {punch.breaks?.length
                                ? punch.breaks.map((b: any, i: number) => (
                                    <span key={i} className="block text-xs leading-relaxed">
                                      {new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {b.end ? ` – ${new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (active)'}
                                    </span>
                                  ))
                                : <span className="text-gray-400">None</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Department Detail Modal */}
      <Dialog open={showDepartmentModal} onOpenChange={(v) => { setShowDepartmentModal(v); if (!v) setSelectedDepartment(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedDepartment}</DialogTitle>
            <DialogDescription>{groupedByDepartment[selectedDepartment || '']?.length || 0} team members</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {(groupedByDepartment[selectedDepartment || ''] || []).map(emp => (
              <div key={getId(emp)} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${emp.level === 'Manager' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                    {emp.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-sm text-gray-600">{emp.role}</div>
                    <div className="text-xs text-gray-400">{emp.email}</div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  {emp.level === 'Manager' && <Badge className="bg-amber-500 hover:bg-amber-500">Manager</Badge>}
                  <div className="text-sm text-gray-700 font-medium">${emp.hourlyRate}/hr</div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Management Modal (full-screen overlay) */}
      {showEmployeeManagement && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
          <div className="w-full max-w-5xl mx-4 bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-gray-200 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Employee Management</h2>
                <p className="text-sm text-gray-500">Manage roles, promote/demote, add or remove employees</p>
              </div>
              <button onClick={() => setShowEmployeeManagement(false)} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors">✕</button>
            </div>

            <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search by name, email, department..." value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} className="pl-10 rounded-xl h-10" />
              </div>
              <Button className="rounded-full bg-[#2563EB] hover:bg-[#1d4ed8]" onClick={() => setShowAddEmployeeModal(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add Employee
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="outline" className="rounded-full" onClick={() => setShowBulkActions(true)}>
                  Bulk Actions ({selectedIds.size})
                </Button>
              )}
            </div>

            <div className="p-6 space-y-6">
              {/* Managers */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-600" />
                  Managers ({groupedByLevel.Manager.length})
                </h3>
                <div className="space-y-2">
                  {groupedByLevel.Manager.filter(e => filteredEmployees.includes(e)).map(emp => (
                    <div key={getId(emp)} className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={selectedIds.has(getId(emp))} onChange={() => toggleBulkSelect(getId(emp))} className="w-4 h-4 rounded" />
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-semibold">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-sm text-gray-600">{emp.role} &bull; {emp.department}</div>
                          <div className="text-xs text-gray-400">{emp.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge variant="secondary">${emp.hourlyRate}/hr</Badge>
                        <Button size="sm" variant="outline" onClick={() => handleViewAttendance(emp)}>
                          <Clock className="w-3.5 h-3.5 mr-1" /> History
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedEmployee(emp); setShowPromoteModal(true); }}>
                          <ArrowDownCircle className="w-3.5 h-3.5 mr-1" /> Demote
                        </Button>
                        <Button size="sm" variant="ghost" className="hover:bg-red-50 hover:text-red-600" onClick={() => { setSelectedEmployee(emp); setShowRemoveModal(true); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {groupedByLevel.Manager.filter(e => filteredEmployees.includes(e)).length === 0 && (
                    <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">No managers match your search.</div>
                  )}
                </div>
              </div>

              {/* Employees */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Employees ({groupedByLevel.Employee.length})
                </h3>
                <div className="space-y-2">
                  {groupedByLevel.Employee.filter(e => filteredEmployees.includes(e)).map(emp => (
                    <div key={getId(emp)} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between group hover:border-blue-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={selectedIds.has(getId(emp))} onChange={() => toggleBulkSelect(getId(emp))} className="w-4 h-4 rounded" />
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-sm text-gray-600">{emp.role} &bull; {emp.department}</div>
                          <div className="text-xs text-gray-400">{emp.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge variant="secondary">${emp.hourlyRate}/hr</Badge>
                        <Button size="sm" variant="outline" onClick={() => handleViewAttendance(emp)}>
                          <Clock className="w-3.5 h-3.5 mr-1" /> History
                        </Button>
                        <Button size="sm" variant="outline" className="border-green-200 text-green-600 hover:bg-green-50" onClick={() => { setSelectedEmployee(emp); setShowPromoteModal(true); }}>
                          <ArrowUpCircle className="w-3.5 h-3.5 mr-1" /> Promote
                        </Button>
                        <Button size="sm" variant="ghost" className="hover:bg-red-50 hover:text-red-600" onClick={() => { setSelectedEmployee(emp); setShowRemoveModal(true); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Modal */}
      <Dialog open={showBulkActions} onOpenChange={setShowBulkActions}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Bulk Actions</DialogTitle>
            <DialogDescription>Apply action to {selectedIds.size} selected employee(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <Label>Move to Department</Label>
            {['Front of House', 'Kitchen', 'Bar', 'Management'].map(dept => (
              <Button key={dept} variant="outline" className="w-full justify-start rounded-xl" onClick={() => handleBulkDepartmentChange(dept)}>
                <Building2 className="w-4 h-4 mr-2" /> {dept}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Employee Modal */}
      <Dialog open={showAddEmployeeModal} onOpenChange={setShowAddEmployeeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Add New Employee</DialogTitle>
            <DialogDescription>Add a new team member to your restaurant</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="emp-name">Full Name</Label>
              <Input id="emp-name" placeholder="e.g. Jane Doe" value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-email">Email</Label>
              <Input id="emp-email" type="email" placeholder="jane@restaurant.com" value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-password">Initial Password (min 6 chars)</Label>
              <Input id="emp-password" type="password" placeholder="Employee can change this later" value={newEmployee.password} onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })} className="rounded-xl h-11" />
              <p className="text-xs text-muted-foreground">Employee will use this to sign in and can change it in their dashboard.</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newEmployee.role} onValueChange={v => setNewEmployee({ ...newEmployee, role: v })}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Server', 'Bartender', 'Chef', 'Manager'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={newEmployee.department} onValueChange={v => setNewEmployee({ ...newEmployee, department: v })}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Front of House', 'Kitchen', 'Bar', 'Management'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-rate">Hourly Rate ($)</Label>
              <Input id="emp-rate" type="number" min="0" value={newEmployee.hourlyRate} onChange={e => setNewEmployee({ ...newEmployee, hourlyRate: Number(e.target.value) })} className="rounded-xl h-11" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-full h-11" onClick={() => setShowAddEmployeeModal(false)}>Cancel</Button>
              <Button className="flex-1 rounded-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8]" onClick={handleAddEmployee}>Add Employee</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Financial Report Modal */}
      <Dialog open={showFinancialReport} onOpenChange={setShowFinancialReport}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Financial Reports</DialogTitle>
            <DialogDescription>Comprehensive wages, tips, and labor cost analytics</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2563EB]" /> Daily — {todayLabel}
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl border border-green-200 bg-green-50">
                  <div className="text-sm text-gray-600 mb-2">Wages</div>
                  <div className="text-3xl font-bold text-green-700">${(dailyReport?.totalWages ?? 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-2">{(dailyReport?.totalHours ?? 0).toFixed(1)} hours</div>
                </div>
                <div className="p-5 rounded-xl border border-purple-200 bg-purple-50">
                  <div className="text-sm text-gray-600 mb-2">Tips</div>
                  <div className="text-3xl font-bold text-purple-700">${(dailyReport?.totalTips ?? 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-2">Proportional split</div>
                </div>
                <div className="p-5 rounded-xl border border-blue-200 bg-blue-50">
                  <div className="text-sm text-gray-600 mb-2">Combined</div>
                  <div className="text-3xl font-bold text-blue-700">${((dailyReport?.totalWages ?? 0) + (dailyReport?.totalTips ?? 0)).toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-2">Total payout</div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#2563EB]" /> Weekly
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-600 mb-2">Wages (week)</div>
                  <div className="text-2xl font-bold">${(weeklyReport?.totalWages ?? 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-500 mt-2">{(weeklyReport?.hoursWorked ?? 0).toFixed(1)} hours</div>
                </div>
                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-600 mb-2">Tips (week)</div>
                  <div className="text-2xl font-bold">${(weeklyReport?.totalTips ?? 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-500 mt-2">Combined: ${((weeklyReport?.totalWages ?? 0) + (weeklyReport?.totalTips ?? 0)).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Promote/Demote Modal */}
      <Dialog open={showPromoteModal} onOpenChange={setShowPromoteModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedEmployee?.level === 'Manager' ? 'Demote Manager' : 'Promote to Manager'}</DialogTitle>
            <DialogDescription>{selectedEmployee?.level === 'Manager' ? 'Remove manager privileges' : 'Grant manager privileges'}</DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6 mt-4">
              <div className="p-5 rounded-xl border border-gray-200 bg-gray-50 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {selectedEmployee.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-semibold text-lg">{selectedEmployee.name}</div>
                  <div className="text-sm text-gray-600">{selectedEmployee.role} &bull; {selectedEmployee.department}</div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-amber-900">{selectedEmployee.level === 'Manager' ? 'This will remove manager access' : 'This will grant full manager access'}</div>
                    <div className="text-sm text-amber-700 mt-1">{selectedEmployee.level === 'Manager' ? 'They will lose schedule, approval, and manager features.' : 'They will gain schedule, approval, and all manager features.'}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setShowPromoteModal(false)}>Cancel</Button>
                <Button className={`flex-1 rounded-xl h-11 ${selectedEmployee.level === 'Manager' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#22C55E] hover:bg-[#22C55E]/90'}`} onClick={() => handlePromote(selectedEmployee)}>
                  {selectedEmployee.level === 'Manager' ? <><ArrowDownCircle className="w-4 h-4 mr-2" /> Demote</> : <><ArrowUpCircle className="w-4 h-4 mr-2" /> Promote</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Employee Modal */}
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Remove Employee</DialogTitle>
            <DialogDescription>Permanently remove this employee</DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6 mt-4">
              <div className="p-5 rounded-xl border border-gray-200 bg-gray-50 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-lg">
                  {selectedEmployee.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-semibold text-lg">{selectedEmployee.name}</div>
                  <div className="text-sm text-gray-600">{selectedEmployee.role} &bull; {selectedEmployee.department}</div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <UserX className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-red-900">This action cannot be undone</div>
                    <div className="text-sm text-red-700 mt-1">The employee record and their login account will be permanently deleted.</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setShowRemoveModal(false)}>Cancel</Button>
                <Button className="flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-700" onClick={() => handleRemoveEmployee(selectedEmployee)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Remove
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Profile Modal */}
      <Dialog open={showAdminProfile} onOpenChange={setShowAdminProfile}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Admin Profile</DialogTitle>
            <DialogDescription>View and manage your account information</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {adminProfileMessage && (
              <div className={`p-3 rounded-lg text-sm ${adminProfileMessage.toLowerCase().includes('updated') || adminProfileMessage.toLowerCase().includes('saved') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {adminProfileMessage}
              </div>
            )}
            <div className="flex items-center gap-4 p-6 rounded-xl bg-amber-50 border border-amber-100">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-3xl font-bold">
                {(adminProfile.name || user.name)?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold">{adminProfile.name || user.name || 'Admin'}</h3>
                <p className="text-gray-600">{user.email}</p>
                <Badge className="bg-amber-500 hover:bg-amber-500 mt-2">Admin</Badge>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Profile Information</h3>
              <div className="grid gap-4">
                <div className="space-y-2"><Label>Full Name</Label><Input disabled={!adminProfileEditing} value={adminProfile.name} onChange={e => setAdminProfile({ ...adminProfile, name: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" disabled={!adminProfileEditing} value={adminProfile.dob} onChange={e => setAdminProfile({ ...adminProfile, dob: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Address</Label><Input disabled={!adminProfileEditing} value={adminProfile.address} placeholder="Street, City, State, ZIP" onChange={e => setAdminProfile({ ...adminProfile, address: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input disabled={!adminProfileEditing} value={adminProfile.phone} placeholder="Phone number" onChange={e => setAdminProfile({ ...adminProfile, phone: e.target.value })} className="rounded-xl" /></div>
              </div>
              {adminProfileEditing ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAdminProfileEditing(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    try { await api.updateProfile(adminProfile, user.token); setAdminProfileMessage('Profile updated successfully.'); setAdminProfileEditing(false); setTimeout(() => setAdminProfileMessage(null), 3000); } catch (e: any) { setAdminProfileMessage(e.message || 'Failed to update'); }
                  }}>Save</Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setAdminProfileEditing(true)}>Edit Profile</Button>
              )}
            </div>

            <div className="space-y-4 border-t pt-6">
              <h3 className="font-medium">Change Password</h3>
              <div className="grid gap-4">
                <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={adminPasswordForm.current} onChange={e => setAdminPasswordForm({ ...adminPasswordForm, current: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>New Password (min 6 chars)</Label><Input type="password" value={adminPasswordForm.new} onChange={e => setAdminPasswordForm({ ...adminPasswordForm, new: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" value={adminPasswordForm.confirm} onChange={e => setAdminPasswordForm({ ...adminPasswordForm, confirm: e.target.value })} className="rounded-xl" /></div>
                <Button onClick={async () => {
                  if (adminPasswordForm.new !== adminPasswordForm.confirm) { setAdminProfileMessage('Passwords do not match.'); return; }
                  if (adminPasswordForm.new.length < 6) { setAdminProfileMessage('New password must be at least 6 characters.'); return; }
                  try { await api.changePassword(adminPasswordForm.current, adminPasswordForm.new, user.token); setAdminProfileMessage('Password updated successfully.'); setAdminPasswordForm({ current: '', new: '', confirm: '' }); setTimeout(() => setAdminProfileMessage(null), 3000); } catch (e: any) { setAdminProfileMessage(e.message || 'Failed to change password'); }
                }}>Update Password</Button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowAdminProfile(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* System Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">System Settings</DialogTitle>
            <DialogDescription>Restaurant system configuration</DialogDescription>
          </DialogHeader>
          {settingsLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-500">Loading settings...</span>
            </div>
          )}
          {settingsError && !settingsLoading && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {settingsError}
            </div>
          )}
          {settings && !settingsLoading && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Business Name</Label><Input disabled={!settingsEditing} value={settingsForm.businessName || ''} onChange={e => setSettingsForm({ ...settingsForm, businessName: e.target.value })} className="rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Opening Time</Label><Input type="time" disabled={!settingsEditing} value={settingsForm.businessHoursOpen || ''} onChange={e => setSettingsForm({ ...settingsForm, businessHoursOpen: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Closing Time</Label><Input type="time" disabled={!settingsEditing} value={settingsForm.businessHoursClose || ''} onChange={e => setSettingsForm({ ...settingsForm, businessHoursClose: e.target.value })} className="rounded-xl" /></div>
              </div>
              <div className="space-y-2">
                <Label>Tip Distribution</Label>
                <Select disabled={!settingsEditing} value={settingsForm.tipDistribution || 'proportional'} onValueChange={v => setSettingsForm({ ...settingsForm, tipDistribution: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="proportional">Proportional (by hours)</SelectItem><SelectItem value="equal">Equal split</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Overtime Threshold (hours/week)</Label><Input type="number" disabled={!settingsEditing} value={settingsForm.overtimeThreshold || 40} onChange={e => setSettingsForm({ ...settingsForm, overtimeThreshold: Number(e.target.value) })} className="rounded-xl" /></div>
              <div className="space-y-2"><Label>Break Duration (minutes)</Label><Input type="number" disabled={!settingsEditing} value={settingsForm.breakDurationMinutes || 30} onChange={e => setSettingsForm({ ...settingsForm, breakDurationMinutes: Number(e.target.value) })} className="rounded-xl" /></div>
              <div className="space-y-2">
                <Label>Payroll Cycle</Label>
                <Select disabled={!settingsEditing} value={settingsForm.payrollCycle || 'biweekly'} onValueChange={v => setSettingsForm({ ...settingsForm, payrollCycle: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="biweekly">Bi-weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                </Select>
              </div>
              {settingsEditing ? (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setSettingsEditing(false); setSettingsForm(settings); }}>Cancel</Button>
                  <Button className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8]" onClick={handleSaveSettings}>Save Settings</Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setSettingsEditing(true)}>Edit Settings</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Shifts Today Modal */}
      <Dialog open={showShiftsModal} onOpenChange={setShowShiftsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Shifts Today</DialogTitle>
            <DialogDescription>All scheduled shifts for {todayLabel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {todaysShifts.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">No shifts scheduled for today.</div>
            ) : (
              todaysShifts.map((shift, idx) => {
                const dur = calculateShiftDurationHours(shift.startTime, shift.endTime);
                return (
                  <div key={shift._id || idx} className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
                        {shift.employee?.split(' ').map(n => n[0]).join('') || '?'}
                      </div>
                      <div>
                        <div className="font-medium">{shift.employee}</div>
                        <div className="text-sm text-gray-600">{shift.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium tabular-nums">{shift.startTime} – {shift.endTime}</div>
                      <div className="text-sm text-gray-500">{dur.toFixed(1)} hours</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications Modal */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Notifications</DialogTitle>
            <DialogDescription>Alerts and important updates</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {notifications.length === 0 && <div className="p-6 text-center text-gray-500 rounded-xl border border-dashed border-gray-200">All clear — no alerts right now.</div>}
            {notifications.map((notif, idx) => (
              <div key={idx} className={`p-4 rounded-xl border flex items-start gap-3 ${notif.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
                {notif.severity === 'warning' ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" /> : <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
                <div>
                  <div className={`font-semibold text-sm ${notif.severity === 'warning' ? 'text-amber-900' : 'text-blue-900'}`}>{notif.message}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(notif.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Attendance History Modal */}
      <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Attendance History</DialogTitle>
            <DialogDescription>{selectedEmployee?.name} — punch records</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {attendancePunches.length === 0 && <div className="p-6 text-center text-gray-500 rounded-xl border border-dashed border-gray-200">No punch records for this employee.</div>}
            {[...attendancePunches].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()).map(punch => {
              const pIn = new Date(punch.clockIn);
              const pOut = punch.clockOut ? new Date(punch.clockOut) : null;
              const dur = pOut ? Math.round((pOut.getTime() - pIn.getTime()) / 60000) : null;
              return (
                <div key={punch._id} className={`rounded-xl border p-4 ${!pOut ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{pIn.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    {dur != null ? <Badge variant="secondary">{Math.floor(dur / 60)}h {dur % 60}m</Badge> : <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-6 text-sm">
                    <div><span className="text-gray-500">In: </span><span className="font-semibold text-emerald-700">{pIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                    <div><span className="text-gray-500">Out: </span><span className={`font-semibold ${pOut ? 'text-red-600' : 'text-amber-600'}`}>{pOut ? pOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
                    {punch.breaks?.length > 0 && <div><span className="text-gray-500">Breaks: {punch.breaks.length}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
