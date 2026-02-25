import { Calendar, Users, RefreshCw, Plus, FileText, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { ScheduleBuilder } from './schedule-builder';
import { Clock, Mail, Phone, MapPin, Building2, Shield, Settings, Bell, Trash2 } from 'lucide-react';
import { addDays, calculateShiftDurationHours, formatHours, formatLongDate, formatMonthDay, startOfWeek, toISODate } from '../utils/time';
import { api } from '../api/client';
import { useEffect } from 'react';

type Props = {
  onNavigate: (page: string) => void;
  onLogout: () => void;
  user: { id: string; name: string; role: string; token: string };
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
};

type Punch = {
  _id: string;
  employeeId: string;
  employeeName: string;
  clockIn: string;
  clockOut?: string;
  breaks: { start: string; end?: string }[];
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
  
  // Shift management state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [tips, setTips] = useState<{ _id: string; amount: number; date: string; notes?: string }[]>([]);
  const [tipAmount, setTipAmount] = useState<string>('');
  const [tipNotes, setTipNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const onHolidayEmployees: Employee[] = [];
  
  // Create shift form state
  const [newShift, setNewShift] = useState({
    employee: '',
    role: '',
    startTime: '',
    endTime: '',
    date: ''
  });

  const swapRequests = [
    { id: 1, employee: 'Alex Rodriguez', shift: 'Wed · 4–10 PM', role: 'Server', reason: 'Have a final exam', type: 'swap' },
    { id: 2, employee: 'Sarah Chen', shift: 'Thu · 5–11 PM', role: 'Server', reason: 'Family emergency', type: 'swap' },
    { id: 3, employee: 'Jordan Lee', shift: 'Sat · 11 AM–5 PM', role: 'Host', reason: "Doctor's appointment", type: 'swap' },
    { id: 4, employee: 'Taylor Kim', shift: 'Fri · 6 PM–12 AM', role: 'Bartender', reason: 'Personal leave', type: 'leave' },
    { id: 5, employee: 'Morgan Davis', shift: 'Sun · 12 PM–6 PM', role: 'Server', reason: 'Sick leave', type: 'leave' },
  ];

  const liveEmployeeStatus = employees.map((emp) => {
    const openPunch = punches.find((p) => p.employeeId === emp._id && !p.clockOut);
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

  const todaysShifts = shifts.filter(shift => shift.date === todayIso);

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

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [empList, shiftList, punchList, tipList] = await Promise.all([
          api.getEmployees(user.token),
          api.getShifts({ start: toISODate(week1Start), end: toISODate(week2End) }, user.token),
          api.getPunches({}, user.token),
          api.getTips(todayIso, user.token),
        ]);
        setEmployees(empList as Employee[]);
        setShifts(shiftList as Shift[]);
        setPunches(punchList as Punch[]);
        setTips(tipList as any[]);
      } catch (err: any) {
        setConfirmationMessage(err.message || 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.token, week1Start, week2End, todayIso]);

  return (
    <div className="min-h-screen">
      {showScheduleBuilder ? (
        <ScheduleBuilder token={user.token} onClose={() => setShowScheduleBuilder(false)} />
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
            <button
              onClick={() => setShowManagerProfile(true)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
            >
              P
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
              <span className="text-3xl">{shifts.filter(s => s.date === todayIso).length}</span>
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
              <span className="text-3xl">5</span>
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
                          {[4, 5, 6, 5, 7, 8, 6][index]}
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
                          {[5, 6, 4, 6, 8, 9, 7][index]}
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
              <Badge variant="secondary" className="rounded-full">5 new</Badge>
            </div>

            <div className="space-y-3">
              {swapRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors space-y-3">
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
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      className="flex-1 rounded-full bg-[#22C55E] hover:bg-[#22C55E]/90 h-8"
                      onClick={() => handleApproveRequest(request.employee, request.type)}
                    >
                      Approve
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-full border-red-200 text-red-600 hover:bg-red-50 h-8"
                      onClick={() => handleDeclineRequest(request.employee, request.type)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
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
              <p className="text-xs text-gray-500 mt-1">Real-time clock-in/out transparency</p>
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

        {/* Time Punches */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl">Time punches</h2>
              <p className="text-xs text-gray-500 mt-1">Clock in/out and breaks (live from DB)</p>
            </div>
            <Badge variant="secondary" className="rounded-full">{punches.length} records</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Clock in</th>
                  <th className="py-2 pr-4">Clock out</th>
                  <th className="py-2 pr-4">Breaks</th>
                </tr>
              </thead>
              <tbody>
                {punches.slice(0, 10).map((punch) => (
                  <tr key={punch._id} className="border-t border-gray-200">
                    <td className="py-2 pr-4">{punch.employeeName}</td>
                    <td className="py-2 pr-4">{new Date(punch.clockIn).toLocaleString()}</td>
                    <td className="py-2 pr-4">{punch.clockOut ? new Date(punch.clockOut).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-4">
                      {punch.breaks && punch.breaks.length
                        ? punch.breaks.map((b: any, idx: number) => (
                            <span key={idx} className="mr-2">
                              {new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-
                              {b.end ? new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '…'}
                            </span>
                          ))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <div className="text-2xl">$1,240</div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100">
                <div className="text-sm text-gray-600 mb-1">Total tips</div>
                <div className="text-2xl">$280</div>
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
            <DialogTitle className="text-2xl">Team Members</DialogTitle>
            <DialogDescription>
              All active employees and those currently on holiday
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                Active Employees ({employees.length})
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
              <div key={request.id} className="p-5 rounded-xl border-2 border-gray-200 bg-gray-50">
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

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 rounded-xl bg-[#22C55E] hover:bg-[#22C55E]/90"
                    onClick={() => {
                      handleApproveRequest(request.employee, request.type);
                      setShowSwapRequestsModal(false);
                    }}
                  >
                    Approve
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      handleDeclineRequest(request.employee, request.type);
                      setShowSwapRequestsModal(false);
                    }}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
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
                  {['Server', 'Host', 'Bartender', 'Chef', 'Manager'].map((role) => (
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
            {shifts.filter(shift => shift.date === selectedDay?.date).map((shift, index) => (
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

      {/* Manager Profile Modal */}
      <Dialog open={showManagerProfile} onOpenChange={setShowManagerProfile}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Manager Profile</DialogTitle>
            <DialogDescription>
              View and manage your account information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Profile Header */}
            <div className="flex items-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-3xl">
                P
              </div>
              <div className="flex-1">
                <h3 className="text-2xl">Prabesh Shrestha</h3>
                <p className="text-gray-600">Restaurant Manager</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-[#2563EB]">Manager</Badge>
                  <Badge variant="secondary">Full Access</Badge>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#2563EB]" />
                Contact Information
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Email</span>
                  </div>
                  <div className="font-medium">Prabesh.Shrestha@georgebrown.ca</div>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Phone</span>
                  </div>
                  <div className="font-medium">+1 555 555-5555</div>
                </div>
              </div>
            </div>

            {/* Restaurant Information */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#2563EB]" />
                Restaurant Information
              </h3>
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Restaurant Name</div>
                  <div className="font-medium">Pokhara Restro & Bar</div>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-start gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-sm text-gray-600">Address</span>
                  </div>
                  <div className="font-medium">123 Main Street, Toronto, ON M5V 2T6</div>
                </div>
              </div>
            </div>

            {/* Account Stats */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#2563EB]" />
                Account Overview
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
                  <div className="text-2xl font-medium text-blue-700">8</div>
                  <div className="text-sm text-gray-600 mt-1">Team Members</div>
                </div>
                <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-center">
                  <div className="text-2xl font-medium text-green-700">156</div>
                  <div className="text-sm text-gray-600 mt-1">Total Shifts</div>
                </div>
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 text-center">
                  <div className="text-2xl font-medium text-purple-700">3</div>
                  <div className="text-sm text-gray-600 mt-1">Months Active</div>
                </div>
              </div>
            </div>

            {/* Quick Settings */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#2563EB]" />
                Quick Settings
              </h3>
              <div className="space-y-2">
                <button className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-600" />
                    <div className="text-left">
                      <div className="font-medium">Notifications</div>
                      <div className="text-sm text-gray-600">Manage notification preferences</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <button className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <div className="text-left">
                      <div className="font-medium">Privacy & Security</div>
                      <div className="text-sm text-gray-600">Password and security settings</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <button className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-600" />
                    <div className="text-left">
                      <div className="font-medium">Restaurant Settings</div>
                      <div className="text-sm text-gray-600">Manage restaurant details</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline"
                className="flex-1 rounded-xl h-12"
                onClick={() => setShowManagerProfile(false)}
              >
                Close
              </Button>
              <Button 
                className="flex-1 rounded-xl h-12 bg-[#2563EB] hover:bg-[#1d4ed8]"
                onClick={() => setShowManagerProfile(false)}
              >
                Edit Profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}
