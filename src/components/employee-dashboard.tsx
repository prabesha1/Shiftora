import { Calendar, DollarSign, Clock, ChevronRight, LogIn, LogOut, Coffee, Loader2, Settings, Key, Bell, CheckCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api/client';
import { DateTimePanel } from './datetime-panel';
import { calculateShiftDurationHours, formatHours, toISODate } from '../utils/time';

type Props = {
  onNavigate: (page: string) => void;
  onLogout: () => void;
  user: { id: string; name: string; email: string; token: string };
};

type PunchStatus = 'not-punched-in' | 'punched-in' | 'on-break';

export function EmployeeDashboard({ onNavigate, onLogout, user }: Props) {
  const [swapRequestSent, setSwapRequestSent] = useState(false);
  const [punchStatus, setPunchStatus] = useState<PunchStatus>('not-punched-in');
  const [showPunchOutModal, setShowPunchOutModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showAllShiftsModal, setShowAllShiftsModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [punchInTime, setPunchInTime] = useState<string>('');
  const [breakStartTime, setBreakStartTime] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>(user.id);
  const [employeeProfile, setEmployeeProfile] = useState<any | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<any | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<any[]>([]);
  const [shiftSelection, setShiftSelection] = useState<string>('');
  const [swapReason, setSwapReason] = useState<string>('');
  const [punchGatePassed, setPunchGatePassed] = useState(false);
  const [shifts, setShifts] = useState<any[]>([]);
  const [punches, setPunches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profile, setProfile] = useState({ name: '', dob: '', address: '', phone: '' });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [changePasswordForm, setChangePasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [changePasswordMessage, setChangePasswordMessage] = useState<string | null>(null);
  const [liveTime, setLiveTime] = useState(() => new Date());
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const todayIso = toISODate(new Date());

  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const notifs = await api.getUserNotifications(user.token);
      setUserNotifications(notifs);
    } catch {}
  }, [user.token]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showProfileModal) {
      api.getProfile(user.token).then((p) => setProfile({ name: p.name || '', dob: p.dob || '', address: p.address || '', phone: p.phone || '' })).catch(() => {});
    }
  }, [showProfileModal, user.token]);

  const deriveStatusFromPunches = (records: any[]): PunchStatus => {
    if (!records.length) return 'not-punched-in';
    const latest = records[records.length - 1];
    if (latest.breaks && latest.breaks.length) {
      const lastBreak = latest.breaks[latest.breaks.length - 1];
      if (lastBreak && !lastBreak.end) return 'on-break';
    }
    if (latest.clockIn && !latest.clockOut) return 'punched-in';
    return 'not-punched-in';
  };

  const refreshData = async () => {
    try {
      setLoading(true);
      const employeesList = await api.getEmployees(user.token);
      const profile =
        (employeesList as any[]).find((e: any) => e.userId?.toString && e.userId.toString() === user.id) ||
        (employeesList as any[]).find((e: any) => e.email === user.email) ||
        (employeesList as any[])[0];
      setEmployeeProfile(profile || null);

      const targetEmployeeId = (profile && (profile._id || profile.userId || user.id)) || user.id;
      setEmployeeId(String(targetEmployeeId));

      let shiftRes = await api.getShifts({ employeeId: targetEmployeeId }, user.token);
      if ((shiftRes as any[]).length === 0) {
        const allShifts = await api.getShifts({}, user.token);
        shiftRes = (allShifts as any[]).filter((s: any) => s.employee === user.name);
      }
      const punchRes = await api.getPunches({ employeeId: targetEmployeeId }, user.token);

      const weekly = await api.getEmployeeWeekly(targetEmployeeId, 4, user.token, user.email);
      setWeeklySummary((weekly as any)?.weeks?.[0] || null);
      setWeeklyHistory((weekly as any)?.weeks || []);

      setShifts(shiftRes as any[]);
      setPunches(punchRes as any[]);

      const derivedStatus = deriveStatusFromPunches(punchRes as any[]);
      setPunchStatus(derivedStatus);

      if (derivedStatus === 'punched-in') {
        const latestPunch = (punchRes as any[])[(punchRes as any[]).length - 1];
        if (latestPunch?.clockIn) {
          setPunchInTime(new Date(latestPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        setPunchGatePassed(true);
      } else if (derivedStatus === 'on-break') {
        const latestPunch = (punchRes as any[])[(punchRes as any[]).length - 1];
        if (latestPunch?.clockIn) {
          setPunchInTime(new Date(latestPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        const lastBreak = latestPunch?.breaks?.[latestPunch.breaks.length - 1];
        if (lastBreak?.start) {
          setBreakStartTime(new Date(lastBreak.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        setPunchGatePassed(true);
      }
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  useEffect(() => {
    refreshData();
  }, [user.id, user.token, user.email]);

  const handlePunchIn = async () => {
    try {
      await api.clockIn({ employeeId }, user.token);
      setPunchStatus('punched-in');
      setPunchInTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setPunchGatePassed(true);
      refreshData();
    } catch (err: any) {
      setProfileMessage(err.message || 'Failed to punch in.');
      setTimeout(() => setProfileMessage(null), 3000);
    }
  };

  const handlePunchOut = async () => {
    try {
      await api.clockOut({ employeeId }, user.token);
      setPunchStatus('not-punched-in');
      setPunchInTime('');
      setShowPunchOutModal(false);
      refreshData();
    } catch (err: any) {
      setProfileMessage(err.message || 'Failed to punch out.');
      setTimeout(() => setProfileMessage(null), 3000);
    }
  };

  const handleStartBreak = async () => {
    try {
      await api.breakStart({ employeeId }, user.token);
      setBreakStartTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setPunchStatus('on-break');
      setShowBreakModal(false);
      refreshData();
    } catch (err: any) {
      setProfileMessage(err.message || 'Failed to start break.');
      setTimeout(() => setProfileMessage(null), 3000);
    }
  };

  const handleEndBreak = async () => {
    try {
      await api.breakEnd({ employeeId }, user.token);
      setPunchStatus('punched-in');
      setBreakStartTime('');
      refreshData();
    } catch (err: any) {
      setProfileMessage(err.message || 'Failed to end break.');
      setTimeout(() => setProfileMessage(null), 3000);
    }
  };

  const getCurrentShift = () => {
    const upcoming = [...shifts]
      .filter((s) => s.date >= todayIso)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0];
    if (upcoming) {
      const isToday = upcoming.date === todayIso;
      const dayLabel = new Date(upcoming.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      const duration = calculateShiftDurationHours(upcoming.startTime, upcoming.endTime);
      return {
        day: isToday ? dayLabel : dayLabel,
        time: `${upcoming.startTime} – ${upcoming.endTime}`,
        role: upcoming.role || 'Server',
        hours: duration,
        isToday,
      };
    }
    return {
      day: 'Next shift available',
      time: 'No upcoming shifts',
      role: 'Server',
      hours: 0,
      isToday: false,
    };
  };

  const shift = getCurrentShift();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (punchStatus === 'not-punched-in' && !punchGatePassed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <span className="text-2xl tracking-tight">
              <span className="font-semibold text-[#2563EB]">Shift</span>
              <span className="text-black">ora</span>
            </span>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mx-auto shadow-lg shadow-orange-200">
                <LogIn className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl">Welcome, {user.name}!</h1>
              <p className="text-gray-600">Ready to start your shift?</p>
            </div>

            <div className="p-5 rounded-2xl border-2 border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <Calendar className="w-5 h-5" />
                <span className="font-semibold">Today&apos;s shift</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{shift.day}</div>
              <div className="text-gray-600 mb-2">{shift.time}</div>
              <div className="flex items-center justify-between">
                <Badge className="bg-blue-600 hover:bg-blue-600">{shift.role}</Badge>
                <span className="text-sm text-gray-600">
                  {shift.hours > 0 ? `${shift.hours} hrs scheduled` : 'No shift scheduled'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-orange-900">Before you begin</div>
                  <ul className="text-sm text-orange-800 space-y-0.5 list-disc list-inside">
                    <li>Your time will be tracked from punch in</li>
                    <li>Remember to take your scheduled break</li>
                    <li>Manager will be notified when you punch in</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              className="w-full rounded-2xl h-14 inline-flex items-center justify-center gap-2 text-base font-bold text-white shadow-lg shadow-orange-200 transition-all"
              style={{ background: 'linear-gradient(to right, #f97316, #ea580c)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'linear-gradient(to right, #ea580c, #c2410c)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(to right, #f97316, #ea580c)')}
              onClick={handlePunchIn}
            >
              <LogIn className="w-5 h-5" />
              Punch In & Start Shift
            </button>

            <button
              onClick={() => setPunchGatePassed(true)}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Continue to dashboard without punching in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl tracking-tight">
                <span className="font-semibold text-[#2563EB]">Shift</span><span className="text-black">ora</span>
              </span>
            </div>
            <Badge variant="secondary" className="rounded-full">Employee</Badge>
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
                      <button onClick={async () => {
                        await api.markAllNotificationsRead(user.token);
                        setUserNotifications(prev => prev.map(n => ({ ...n, read: true })));
                      }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
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
            <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2" onClick={() => setShowProfileModal(true)}>
              Profile
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2" onClick={() => setShowChangePasswordModal(true)}>
              <Key className="w-4 h-4" />
              Change Password
            </Button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white hover:ring-2 hover:ring-green-300 cursor-pointer"
            >
              {user.name ? user.name[0].toUpperCase() : 'E'}
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
          <h1 className="text-4xl">Welcome, {user.name}</h1>
          <p className="text-gray-600">View your schedule, request swaps, and track your earnings.</p>
        </div>

        {/* Time Clock - Punch In/Out */}
        <div className="rounded-2xl border-2 shadow-lg overflow-hidden" style={{ borderColor: punchStatus === 'punched-in' ? '#6ee7b7' : punchStatus === 'on-break' ? '#fbbf24' : '#94a3b8', backgroundColor: punchStatus === 'punched-in' ? '#ecfdf5' : punchStatus === 'on-break' ? '#fffbeb' : '#f1f5f9' }}>
          {/* Status header */}
          <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: punchStatus === 'punched-in' ? '#a7f3d0' : punchStatus === 'on-break' ? '#fde68a' : '#cbd5e1', borderBottom: punchStatus === 'punched-in' ? '2px solid #34d399' : punchStatus === 'on-break' ? '2px solid #f59e0b' : '2px solid #94a3b8' }}>
            <h2 className="text-xl font-bold text-slate-900">Time Clock</h2>
            {punchStatus === 'punched-in' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-white" style={{ backgroundColor: '#059669' }}>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Punched In
              </span>
            )}
            {punchStatus === 'on-break' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-white" style={{ backgroundColor: '#d97706' }}>
                <Coffee className="w-4 h-4" />
                On Break
              </span>
            )}
            {punchStatus === 'not-punched-in' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#475569' }}>
                <LogIn className="w-4 h-4" />
                Ready to punch in
              </span>
            )}
          </div>

          <div className="p-6 space-y-6 bg-white">
            {/* Live clock + shift info row */}
            <div className="flex flex-col sm:flex-row gap-6 items-stretch">
              {/* Large live clock display */}
              <div className="flex-1 min-w-0 rounded-2xl p-6 text-white flex flex-col items-center justify-center border-2 shadow-lg" style={{ backgroundColor: '#1e293b', borderColor: '#475569' }}>
                <div className="text-sm font-medium uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Current time</div>
                <div className="text-4xl sm:text-5xl font-mono font-bold tabular-nums text-white">
                  {liveTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
                <div className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                  {liveTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
              </div>

              {/* Shift card */}
              <div className="flex-1 min-w-0 rounded-2xl border-2 p-5 shadow-sm" style={{ borderColor: '#60a5fa', backgroundColor: '#bfdbfe' }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: '#1e3a5f' }}>
                  <Calendar className="w-5 h-5" />
                  <span className="font-bold">{shift.hours > 0 ? "Today's shift" : 'Next shift'}</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 mb-1">{shift.day}</div>
                <div className="text-lg font-semibold text-slate-800 mb-2">{shift.time}</div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium text-white" style={{ backgroundColor: '#2563eb' }}>{shift.role}</span>
                  <span className="text-sm font-medium text-slate-700">
                    {shift.hours > 0 ? `${shift.hours} hrs scheduled` : 'No shift scheduled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Punch status card - when punched in or on break */}
            {punchStatus !== 'not-punched-in' && (
              <div className="rounded-2xl p-6 flex items-center justify-between border-2" style={{ backgroundColor: punchStatus === 'punched-in' ? '#d1fae5' : '#fef3c7', borderColor: punchStatus === 'punched-in' ? '#34d399' : '#fbbf24' }}>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: punchStatus === 'punched-in' ? '#059669' : '#d97706' }}>
                    {punchStatus === 'punched-in' ? (
                      <Clock className="w-8 h-8 text-white" />
                    ) : (
                      <Coffee className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-700">
                      {punchStatus === 'punched-in' ? 'Punched in at' : 'Break started at'}
                    </div>
                    <div className="text-3xl font-bold text-slate-900 tabular-nums">
                      {punchStatus === 'punched-in' ? punchInTime : breakStartTime}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {punchStatus === 'not-punched-in' && (
              <button
                className="w-full rounded-2xl h-16 inline-flex items-center justify-center gap-3 text-lg font-bold text-white border-2 shadow-lg transition-all"
                style={{ backgroundColor: '#ea580c', borderColor: '#c2410c' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c2410c')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                onClick={handlePunchIn}
              >
                <LogIn className="w-6 h-6" />
                Punch In
              </button>
              )}

              {punchStatus === 'punched-in' && (
                <>
                  <button
                    className="rounded-2xl h-16 inline-flex items-center justify-center gap-3 text-lg font-bold text-white border-2 transition-all"
                    style={{ backgroundColor: '#f59e0b', borderColor: '#fbbf24' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
                    onClick={() => setShowBreakModal(true)}
                  >
                    <Coffee className="w-6 h-6" />
                    Start Break
                  </button>
                  <button
                    className="rounded-2xl h-16 inline-flex items-center justify-center gap-3 text-lg font-bold border-2 transition-all"
                    style={{ backgroundColor: '#fef2f2', borderColor: '#ef4444', color: '#b91c1c' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                    onClick={() => setShowPunchOutModal(true)}
                  >
                    <LogOut className="w-6 h-6" />
                    Punch Out
                  </button>
                </>
              )}

              {punchStatus === 'on-break' && (
                <button
                  className="w-full sm:col-span-2 rounded-2xl h-16 inline-flex items-center justify-center gap-3 text-lg font-bold text-white border-2 shadow-lg transition-all"
                  style={{ backgroundColor: '#059669', borderColor: '#047857' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#047857')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
                  onClick={handleEndBreak}
                >
                  <Coffee className="w-6 h-6" />
                  End Break & Resume
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* This week's shifts */}
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">This week</h2>
              <button className="text-sm text-[#2563EB] hover:text-[#1d4ed8]" onClick={() => setShowAllShiftsModal(true)}>View all</button>
            </div>

            <div className="space-y-3">
              {shifts.filter(s => s.date >= todayIso).slice(0,4).map((shift, idx) => {
                const duration = calculateShiftDurationHours(shift.startTime, shift.endTime);
                const dateLabel = new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
                return (
                  <div key={shift._id || idx} className={`p-4 rounded-xl border ${idx === 0 ? 'border-2 border-blue-200 bg-blue-50/50' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">{dateLabel}</span>
                        </div>
                        <div className="text-gray-600">{shift.startTime} – {shift.endTime}</div>
                      </div>
                      <Badge className="bg-blue-600 hover:bg-blue-600">{shift.role}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{formatHours(duration)} hours</span>
                    </div>
                  </div>
                );
              })}
              {shifts.filter(s => s.date >= todayIso).length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600">
                  No scheduled shifts yet.
                </div>
              )}
            </div>
          </div>

          {/* Request shift swap */}
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            {!swapRequestSent ? (
              <>
                <div>
                  <h2 className="text-xl mb-1">Request shift swap</h2>
                  <p className="text-sm text-gray-600">
                    Can't make a shift? Submit a swap request with a reason.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shift-select">Select shift</Label>
                    <Select value={shiftSelection} onValueChange={setShiftSelection}>
                      <SelectTrigger className="rounded-xl h-11" id="shift-select">
                        <SelectValue placeholder="Choose a shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts
                          .filter((s) => s.date >= todayIso)
                          .map((s) => {
                            const label = `${new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })} · ${s.startTime}-${s.endTime} · ${s.role || 'Server'}`;
                            return (
                              <SelectItem key={s._id || label} value={s._id || label}>
                                {label}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea 
                      id="reason"
                      placeholder="Please explain why you need to swap this shift..."
                      className="rounded-xl min-h-[120px] resize-none"
                      value={swapReason}
                      onChange={(e) => setSwapReason(e.target.value)}
                    />
                  </div>

                  <button 
                    className="w-full rounded-full h-11 inline-flex items-center justify-center gap-2 text-sm font-medium text-white transition-all"
                    style={{ backgroundColor: '#2563EB' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563EB')}
                    onClick={async () => {
                      if (!shiftSelection) {
                        alert('Select a shift to request a swap.');
                        return;
                      }
                      if (!swapReason.trim()) {
                        alert('Please provide a reason for the swap request.');
                        return;
                      }
                      const selectedShift =
                        shifts.find((s: any) => (s._id || s.id) === shiftSelection) ||
                        shifts.find(
                          (s: any) =>
                            `${new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })} · ${s.startTime}-${s.endTime} · ${s.role || 'Server'}` ===
                            shiftSelection
                        );
                      try {
                        await api.createRequest({
                          employee: user.name,
                          employeeId,
                          shift: selectedShift
                            ? `${new Date(selectedShift.date + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'long',
                              })} · ${selectedShift.startTime}-${selectedShift.endTime}`
                            : shiftSelection,
                          role: selectedShift?.role || 'Server',
                          reason: swapReason,
                          type: 'swap',
                        }, user.token);
                        setSwapRequestSent(true);
                        setSwapReason('');
                        setShiftSelection('');
                      } catch (err: any) {
                        alert(err.message || 'Failed to send request');
                      }
                    }}
                  >
                    Send swap request
                  </button>

                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <div className="text-sm text-blue-900">
                      <strong>Note:</strong> Your manager will review your request. You'll be notified once it's approved or declined.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#22C55E] flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-xl">Request sent successfully!</h3>
                  <p className="text-gray-600 max-w-sm">
                    Your shift swap request has been sent to your manager for review.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-green-50 border border-green-100 w-full">
                  <div className="text-sm text-green-900">
                    <strong>What's next?</strong> Your manager will review your request and either approve or decline it. This usually takes 24-48 hours.
                  </div>
                </div>

                <Button 
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setSwapRequestSent(false)}
                >
                  Submit another request
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Wages & tips summary */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Wages & tips (this week)</h2>
            <Badge variant="secondary" className="rounded-full">
              {weeklySummary ? `${weeklySummary.weekStart} – ${weeklySummary.weekEnd}` : 'Loading…'}
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-700" />
                </div>
                <div className="text-sm text-gray-600">Wages earned</div>
              </div>
              <div className="text-3xl mb-1">
                {weeklySummary ? `$${weeklySummary.wages.toFixed(2)}` : '$0.00'}
              </div>
              <div className="text-sm text-gray-600 mb-3">
                {weeklySummary && weeklySummary.hoursWorked > 0
                  ? `From ${weeklySummary.hoursWorked.toFixed(2)} hours @ $${weeklySummary.hourlyRate}/hr`
                  : 'No hours logged yet'}
              </div>
              <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-100 rounded-lg px-2 py-1 w-fit">
                <span>Paid on next payday</span>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-200 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-700" />
                </div>
                <div className="text-sm text-gray-600">Tips earned</div>
              </div>
              <div className="text-3xl mb-1">
                {weeklySummary ? `$${weeklySummary.tips.toFixed(2)}` : '$0.00'}
              </div>
              <div className="text-sm text-gray-600 mb-3">From completed shifts (pooled)</div>
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-100 rounded-lg px-2 py-1 w-fit">
                <span>Paid with wages</span>
              </div>
            </div>
          </div>

          {/* Tip info */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                <div className="font-medium text-amber-900">How tips work</div>
                <div className="text-sm text-amber-800 space-y-1">
                  <div>• Tips are pooled daily and split equally among employees who worked that day</div>
                  <div>• Your manager enters the daily tip pool amount</div>
                  <div>• Tips are included with your regular wages on payday</div>
                </div>
              </div>
            </div>
          </div>

          {/* Hours worked */}
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Hours worked this week</span>
                <span className="font-medium">
                  {weeklySummary ? `${weeklySummary.hoursWorked.toFixed(2)} hrs` : '0 hrs'}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, weeklySummary ? (weeklySummary.hoursWorked / 40) * 100 : 0)}%`,
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {weeklySummary ? `${weeklySummary.hoursWorked.toFixed(2)} / 40 hrs target` : '0 / 40 hrs target'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium">Daily breakdown</div>
              </div>
              
              {weeklySummary && weeklySummary.days.some((d: any) => d.hours > 0) ? (
                weeklySummary.days
                  .filter((d: any) => d.hours > 0)
                  .map((d: any) => (
                    <div
                      key={d.date}
                      className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#22C55E] flex items-center justify-center text-xs text-white font-medium">
                          ✓
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-gray-600">
                            {d.hours.toFixed(2)} hrs · Tips ${d.tips.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-[#22C55E]">
                          ${(weeklySummary.hourlyRate * d.hours).toFixed(2)}
                        </div>
                        <div className="text-xs text-green-700">+${d.tips.toFixed(2)} tips</div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
                  No hours logged yet this week. Punch in to start tracking.
                </div>
              )}
            </div>

            {/* Total Summary */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
                <div>
                  <div className="font-medium text-green-900">Total earned this week</div>
                  <div className="text-xs text-green-700 mt-0.5">Wages + tips from completed shifts</div>
                </div>
                <div className="text-2xl text-green-900">
                  {weeklySummary ? `$${(weeklySummary.wages + weeklySummary.tips).toFixed(2)}` : '$0.00'}
                </div>
              </div>
            </div>
          </div>

          <button className="flex items-center gap-2 text-[#2563EB] hover:text-[#1d4ed8] transition-colors" onClick={() => setShowPaymentHistoryModal(true)}>
            View full payment history
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Punch Out Modal */}
      <Dialog open={showPunchOutModal} onOpenChange={setShowPunchOutModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Ready to Punch Out?</DialogTitle>
            <DialogDescription>
              Confirm that you're ending your shift for today
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-xl border-2 border-green-200 bg-green-50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Punched in at</div>
                  <div className="font-medium text-lg">{punchInTime}</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#22C55E] flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Shift: {shift.day} · {shift.time} · {shift.role}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <div className="font-medium text-amber-900">Before you go:</div>
                  <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                    <li>Complete all closing duties</li>
                    <li>Ensure all tips are logged correctly</li>
                    <li>Check with your manager before leaving</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="text-sm text-blue-900">
                Your hours will be recorded and added to this week's timesheet
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline"
              className="flex-1 rounded-xl h-11"
              onClick={() => setShowPunchOutModal(false)}
            >
              Cancel
            </Button>
            <button
              className="flex-1 rounded-xl h-11 inline-flex items-center justify-center gap-2 text-sm font-medium text-white transition-all"
              style={{ backgroundColor: '#ef4444' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
              onClick={handlePunchOut}
            >
              <LogOut className="w-4 h-4" />
              Confirm Punch Out
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Break Modal */}
      <Dialog open={showBreakModal} onOpenChange={setShowBreakModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Start Your Break?</DialogTitle>
            <DialogDescription>
              Take a well-deserved break from your shift
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center">
                  <Coffee className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-medium text-lg">Break Time</div>
                  <div className="text-sm text-gray-600">Recommended: 15-30 minutes</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-sm">
                <span className="text-gray-600">Current shift: </span>
                <span className="font-medium">{shift.day} · {shift.time} · {shift.role}</span>
              </div>
              <div className="text-sm mt-1">
                <span className="text-gray-600">Punched in at: </span>
                <span className="font-medium">{punchInTime}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-green-50 border border-green-100">
              <div className="text-sm text-green-900">
                Break time will be tracked separately from work hours
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline"
              className="flex-1 rounded-xl h-11"
              onClick={() => setShowBreakModal(false)}
            >
              Cancel
            </Button>
            <button
              className="flex-1 rounded-xl h-11 inline-flex items-center justify-center gap-2 text-sm font-medium text-white transition-all"
              style={{ backgroundColor: '#f59e0b' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
              onClick={handleStartBreak}
            >
              <Coffee className="w-4 h-4" />
              Start Break
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* All Shifts Modal */}
      <Dialog open={showAllShiftsModal} onOpenChange={setShowAllShiftsModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">All Shifts</DialogTitle>
            <DialogDescription>
              All your scheduled shifts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {shifts.map((shift, idx) => {
              const duration = calculateShiftDurationHours(shift.startTime, shift.endTime);
              const dayLabel = new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
              const isPast = shift.date < todayIso;
              return (
                <div key={shift._id || idx} className={`p-4 rounded-xl border-2 ${isPast ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-blue-200 bg-blue-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium text-lg">{dayLabel}</div>
                      <div className="text-sm text-gray-600">{shift.startTime} – {shift.endTime}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPast && <Badge variant="secondary">Past</Badge>}
                      <Badge className="bg-blue-600 hover:bg-blue-600">{shift.role}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{formatHours(duration)} hours</span>
                  </div>
                </div>
              );
            })}
            {shifts.length === 0 && (
              <div className="text-sm text-gray-600">No shifts scheduled.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment History Modal */}
      <Dialog open={showPaymentHistoryModal} onOpenChange={setShowPaymentHistoryModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Payment History</DialogTitle>
            <DialogDescription>
              Your weekly payment records with wages and tips breakdown
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {weeklyHistory.length === 0 && (
              <div className="p-4 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600">
                No payment history yet. Your earnings will appear here after your first shift.
              </div>
            )}

            {weeklyHistory.map((week, idx) => {
              const hasData = week.hoursWorked > 0;
              return (
                <div
                  key={week.weekStart}
                  className={`p-5 rounded-xl ${
                    idx === 0
                      ? 'border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50'
                      : 'border border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-medium text-lg">
                        {week.weekStart} – {week.weekEnd}
                      </div>
                      <div className="text-sm text-gray-600">
                        {idx === 0 ? 'Current pay period' : 'Past pay period'}
                      </div>
                    </div>
                    <Badge className={idx === 0 ? 'bg-amber-500 hover:bg-amber-500' : hasData ? 'bg-[#22C55E] hover:bg-[#22C55E]' : 'bg-gray-400 hover:bg-gray-400'}>
                      {idx === 0 ? 'In Progress' : hasData ? 'Paid' : 'No Data'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-3 rounded-lg bg-white/80 border border-gray-100">
                      <div className="text-xs text-gray-600 mb-1">Total Hours</div>
                      <div className="text-xl font-medium">{week.hoursWorked.toFixed(2)} hrs</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/80 border border-gray-100">
                      <div className="text-xs text-gray-600 mb-1">Wages</div>
                      <div className="text-xl font-medium">${week.wages.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/80 border border-gray-100">
                      <div className="text-xs text-gray-600 mb-1">Tips</div>
                      <div className="text-xl font-medium">${week.tips.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/80 border border-gray-100">
                      <div className="text-xs text-gray-600 mb-1">Total Earned</div>
                      <div className="text-xl font-medium text-blue-600">
                        ${(week.wages + week.tips).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {week.days && week.days.some((d: any) => d.hours > 0) && (
                    <details className="mt-3">
                      <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                        View daily breakdown
                      </summary>
                      <div className="mt-2 space-y-1">
                        {week.days.filter((d: any) => d.hours > 0).map((d: any) => (
                          <div key={d.date} className="flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50">
                            <span>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            <span className="text-gray-600">{d.hours.toFixed(2)} hrs · ${(week.hourlyRate * d.hours).toFixed(2)} + ${d.tips.toFixed(2)} tips</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  <div className="text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2 mt-3">
                    {idx === 0
                      ? 'Payment will be included in the next payroll'
                      : hasData ? 'Paid via direct deposit' : 'No hours worked this period'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline"
              className="flex-1 rounded-xl h-11"
              onClick={() => setShowPaymentHistoryModal(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
            <DialogDescription>View and edit your profile information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {profileMessage && (
              <div className={`p-3 rounded-lg text-sm ${profileMessage.toLowerCase().includes('updated') || profileMessage.toLowerCase().includes('saved') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {profileMessage}
              </div>
            )}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50 border border-green-100">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-2xl">
                {(profile.name || user.name)?.[0]?.toUpperCase() || 'E'}
              </div>
              <div>
                <div className="font-semibold text-lg">{profile.name || user.name}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input disabled={!profileEditing} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" disabled={!profileEditing} value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input disabled={!profileEditing} value={profile.address} placeholder="Street, City, State, ZIP" onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input disabled={!profileEditing} value={profile.phone} placeholder="Phone number" onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="rounded-xl" />
              </div>
            </div>
            {profileEditing ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setProfileEditing(false)}>Cancel</Button>
                <Button onClick={async () => {
                  try {
                    await api.updateProfile(profile, user.token);
                    setProfileMessage('Profile updated.');
                    setProfileEditing(false);
                    setTimeout(() => setProfileMessage(null), 3000);
                  } catch (e: any) {
                    setProfileMessage(e.message || 'Failed to update');
                  }
                }}>Save</Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setProfileEditing(true)}>Edit Profile</Button>
            )}
            <div className="border-t pt-4">
              <Button variant="ghost" className="w-full" onClick={() => { setShowProfileModal(false); setShowChangePasswordModal(true); }}>
                <Key className="w-4 h-4 mr-2" />
                Change Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showChangePasswordModal} onOpenChange={setShowChangePasswordModal}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your password. You'll use the new password to sign in next time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {changePasswordMessage && (
              <div className={`p-3 rounded-lg text-sm ${changePasswordMessage.startsWith('Password updated') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {changePasswordMessage}
              </div>
            )}
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                placeholder="Enter current password"
                value={changePasswordForm.current}
                onChange={(e) => setChangePasswordForm((f) => ({ ...f, current: e.target.value }))}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>New Password (min 6 characters)</Label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={changePasswordForm.new}
                onChange={(e) => setChangePasswordForm((f) => ({ ...f, new: e.target.value }))}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={changePasswordForm.confirm}
                onChange={(e) => setChangePasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                className="rounded-xl h-11"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setChangePasswordForm({ current: '', new: '', confirm: '' });
                  setChangePasswordMessage(null);
                }}
              >
                Cancel
              </Button>
              <button
                className="flex-1 rounded-xl h-11 inline-flex items-center justify-center gap-2 text-sm font-medium text-white transition-all"
                style={{ backgroundColor: '#2563EB' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563EB')}
                onClick={async () => {
                  if (changePasswordForm.new !== changePasswordForm.confirm) {
                    setChangePasswordMessage('New passwords do not match.');
                    return;
                  }
                  if (changePasswordForm.new.length < 6) {
                    setChangePasswordMessage('New password must be at least 6 characters.');
                    return;
                  }
                  try {
                    await api.changePassword(changePasswordForm.current, changePasswordForm.new, user.token);
                    setChangePasswordMessage('Password updated successfully.');
                    setChangePasswordForm({ current: '', new: '', confirm: '' });
                    setTimeout(() => {
                      setShowChangePasswordModal(false);
                      setChangePasswordMessage(null);
                    }, 2000);
                  } catch (err: any) {
                    setChangePasswordMessage(err.message || 'Failed to update password.');
                  }
                }}
              >
                Update Password
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
