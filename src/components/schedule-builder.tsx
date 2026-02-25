import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Plus, Users, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { addDays, calculateShiftDurationHours, formatHours, formatMonthDay, startOfWeek, toISODate } from '../utils/time';
import { api } from '../api/client';
import { useEffect } from 'react';

type Props = {
  onClose: () => void;
  token: string;
};

type ShiftBlock = {
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
};

export function ScheduleBuilder({ onClose, token }: Props) {
  const initialWeekStart = startOfWeek(new Date());
  const todayIso = toISODate(new Date());

  const [weekAnchorDate, setWeekAnchorDate] = useState<Date>(initialWeekStart);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ employee: string; date: string; role: string } | null>(null);
  const [shifts, setShifts] = useState<ShiftBlock[]>([]);

  const [newShift, setNewShift] = useState({
    startTime: '',
    endTime: '',
  });

  const generateWeekDays = (anchor: Date) => (
    Array.from({ length: 14 }, (_, index) => {
      const date = addDays(anchor, index);
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: formatMonthDay(date),
        fullDate: toISODate(date),
        dateObj: date,
      };
    })
  );

  const weekDays = useMemo(() => generateWeekDays(weekAnchorDate), [weekAnchorDate]);
  const rangeStartDate = weekDays[0]?.dateObj ?? weekAnchorDate;
  const rangeEndDate = weekDays[weekDays.length - 1]?.dateObj ?? weekAnchorDate;
  const headerYear =
    rangeStartDate.getFullYear() === rangeEndDate.getFullYear()
      ? rangeEndDate.getFullYear().toString()
      : `${rangeStartDate.getFullYear()} – ${rangeEndDate.getFullYear()}`;

  useEffect(() => {
    const load = async () => {
      try {
        const fetched = await api.getShifts(
          { start: toISODate(rangeStartDate), end: toISODate(rangeEndDate) },
          token
        );
        setShifts(fetched as ShiftBlock[]);
      } catch {
        // ignore fetch errors for offline demo
      }
    };
    load();
  }, [token, rangeStartDate, rangeEndDate]);

  const departments = [
    {
      name: 'Front of House',
      color: 'bg-blue-900',
      roles: [
        {
          name: 'Server',
          color: 'bg-orange-100',
          employees: [
            { name: 'Alex Rodriguez', avatar: 'AR', hours: 0 },
            { name: 'Sarah Chen', avatar: 'SC', hours: 6 },
            { name: 'Morgan Davis', avatar: 'MD', hours: 0 },
            { name: 'Riley Martinez', avatar: 'RM', hours: 0 },
          ],
        },
        {
          name: 'Host',
          color: 'bg-purple-100',
          employees: [
            { name: 'Jordan Lee', avatar: 'JL', hours: 6 },
            { name: 'Casey Brown', avatar: 'CB', hours: 0 },
            { name: 'Jamie Wilson', avatar: 'JW', hours: 0 },
          ],
        },
      ],
    },
    {
      name: 'Bar',
      color: 'bg-blue-900',
      roles: [
        {
          name: 'Bartender',
          color: 'bg-green-100',
          employees: [
            { name: 'Taylor Kim', avatar: 'TK', hours: 6 },
          ],
        },
      ],
    },
  ];

  const handleCellClick = (employee: string, date: string, role: string) => {
    setSelectedCell({ employee, date, role });
    setShowAddShiftModal(true);
  };

  const handlePreviousWeek = () => setWeekAnchorDate((prev) => addDays(prev, -7));
  const handleNextWeek = () => setWeekAnchorDate((prev) => addDays(prev, 7));
  const handleJumpToToday = () => setWeekAnchorDate(startOfWeek(new Date()));

  const handleAddShift = () => {
    if (!selectedCell || !newShift.startTime || !newShift.endTime) return;

    const duration = calculateShiftDurationHours(newShift.startTime, newShift.endTime);
    if (duration <= 0) return;

    const shift: ShiftBlock = {
      employeeName: selectedCell.employee,
      date: selectedCell.date,
      startTime: newShift.startTime,
      endTime: newShift.endTime,
      role: selectedCell.role,
    };
    api.createShift(
      {
        employee: shift.employeeName,
        role: shift.role,
        startTime: shift.startTime,
        endTime: shift.endTime,
        date: shift.date,
        durationHours: duration,
      },
      token
    ).then((created: any) => {
      setShifts([...shifts, { ...shift, ...created }]);
    }).catch(() => {
      setShifts([...shifts, shift]); // fallback to local add
    });
    setNewShift({ startTime: '', endTime: '' });
    setShowAddShiftModal(false);
  };

  const handleDeleteShift = (id?: string, index?: number) => {
    if (id) {
      api.deleteShift(id, token).catch(() => {});
    }
    setShifts(shifts.filter((shift, i) => (id ? (shift as any)._id !== id : i !== index)));
  };

  const getShiftsForCell = (employeeName: string, date: string) => {
    return shifts.filter(s => s.employeeName === employeeName && s.date === date);
  };

  const getTotalHours = (employeeName: string) => {
    return shifts
      .filter(s => s.employeeName === employeeName)
      .reduce((total, shift) => total + calculateShiftDurationHours(shift.startTime, shift.endTime), 0);
  };

  const addShiftDisabled =
    !newShift.startTime ||
    !newShift.endTime ||
    calculateShiftDurationHours(newShift.startTime, newShift.endTime) <= 0;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl">Schedule Builder</h1>
              <p className="text-sm text-gray-600">Manage bi-weekly shifts for your team</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-full">
              <Users className="w-4 h-4 mr-2" />
              All Departments
            </Button>
            <Button className="rounded-full bg-[#2563EB] hover:bg-[#1d4ed8]" onClick={() => setShowPublishDialog(true)}>
              Publish Schedule
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePreviousWeek}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-medium">
                {formatMonthDay(rangeStartDate)} – {formatMonthDay(rangeEndDate)}, {headerYear}
              </span>
            </div>
            <button
              onClick={handleNextWeek}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleJumpToToday}>
              Today
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">Week 1</Badge>
            <Badge variant="secondary" className="rounded-full">Week 2</Badge>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1400px]">
          {/* Calendar Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
            <div className="grid grid-cols-[250px_repeat(14,1fr)] gap-px bg-gray-200">
              <div className="bg-white p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>Team Members</span>
                </div>
              </div>
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className={`bg-white p-3 text-center ${
                    index === 7 ? 'border-l-2 border-blue-300' : ''
                  }`}
                >
                  <div className={`text-xs text-gray-500 mb-1 ${
                    day.fullDate === todayIso ? 'text-blue-600' : ''
                  }`}>
                    {day.day}
                  </div>
                  <div className={`text-sm ${
                    day.fullDate === todayIso ? 'font-medium text-blue-600' : ''
                  }`}>
                    {day.date.split(' ')[1]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Employee Rows by Department */}
          {departments.map((department, deptIndex) => (
            <div key={deptIndex} className="mb-1">
              {/* Department Header */}
              <div className={`${department.color} text-white px-4 py-2 text-sm font-medium`}>
                {department.name}
              </div>

              {/* Roles and Employees */}
              {department.roles.map((role, roleIndex) => (
                <div key={roleIndex}>
                  {/* Role Header */}
                  <div className={`${role.color} px-4 py-2 text-sm font-medium flex items-center justify-between`}>
                    <span>{role.name}</span>
                    <span className="text-xs text-gray-600">Open Shifts</span>
                  </div>

                  {/* Employee Rows */}
                  {role.employees.map((employee, empIndex) => {
                    const totalHours = getTotalHours(employee.name);
                    return (
                      <div
                        key={empIndex}
                        className="grid grid-cols-[250px_repeat(14,1fr)] gap-px bg-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        {/* Employee Info */}
                        <div className="bg-white p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs">
                            {employee.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{employee.name}</div>
                            <div className="text-xs text-gray-500">
                              {formatHours(totalHours)}h · ${(totalHours * 30).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {/* Day Cells */}
                        {weekDays.map((day, dayIndex) => {
                          const cellShifts = getShiftsForCell(employee.name, day.fullDate);
                          return (
                            <div
                              key={dayIndex}
                              className={`bg-white p-2 min-h-[60px] cursor-pointer hover:bg-blue-50 transition-colors relative ${
                                dayIndex === 7 ? 'border-l-2 border-blue-300' : ''
                              }`}
                              onClick={() => handleCellClick(employee.name, day.fullDate, role.name)}
                            >
                              {cellShifts.length === 0 ? (
                                <div className="flex items-center justify-center h-full opacity-0 hover:opacity-100">
                                  <Plus className="w-4 h-4 text-gray-400" />
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {cellShifts.map((shift, shiftIndex) => (
                                    <div
                                      key={shiftIndex}
                                      className="relative group"
                                    >
                                      <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded group-hover:bg-blue-600 transition-colors">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="truncate">
                                            {shift.startTime.substring(0, 5)}–{shift.endTime.substring(0, 5)}
                                          </span>
                                          <button
                                            onClick={(e) => {
                                            e.stopPropagation();
                                            const index = shifts.findIndex(
                                              s => s.employeeName === shift.employeeName &&
                                                   s.date === shift.date &&
                                                   s.startTime === shift.startTime
                                            );
                                            handleDeleteShift((shift as any)._id, index);
                                          }}
                                          className="opacity-0 group-hover:opacity-100"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                        </div>
                                        <div className="text-xs opacity-80">
                                          {formatHours(calculateShiftDurationHours(shift.startTime, shift.endTime))}h
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="grid grid-cols-[250px_repeat(14,1fr)] gap-px">
          <div className="text-sm font-medium">Total Hours</div>
          {weekDays.map((day, index) => {
            const dayTotal = shifts
              .filter(s => s.date === day.fullDate)
              .reduce((total, shift) => total + calculateShiftDurationHours(shift.startTime, shift.endTime), 0);
            return (
              <div key={index} className="text-center text-sm">
                <div className="font-medium">{formatHours(dayTotal)}h</div>
                <div className="text-xs text-gray-500">${(dayTotal * 30).toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Shift Modal */}
      <Dialog open={showAddShiftModal} onOpenChange={setShowAddShiftModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Shift</DialogTitle>
            <DialogDescription>
              {selectedCell && (
                <>
                  Add shift for <strong>{selectedCell.employee}</strong> on{' '}
                  <strong>{weekDays.find(d => d.fullDate === selectedCell.date)?.day}, {weekDays.find(d => d.fullDate === selectedCell.date)?.date}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-600">{selectedCell?.role}</Badge>
              </div>
              <div className="text-sm text-gray-600">{selectedCell?.employee}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={newShift.startTime}
                  onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={newShift.endTime}
                  onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            {newShift.startTime && newShift.endTime && (
              <div className="p-3 rounded-lg bg-gray-50 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">
                    {formatHours(calculateShiftDurationHours(newShift.startTime, newShift.endTime))} hours
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600">Estimated pay:</span>
                  <span className="font-medium text-[#22C55E]">
                    ${(calculateShiftDurationHours(newShift.startTime, newShift.endTime) * 30).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => setShowAddShiftModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full bg-[#2563EB] hover:bg-[#1d4ed8]"
                onClick={handleAddShift}
                disabled={addShiftDisabled}
              >
                Add Shift
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish Schedule Dialog */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will publish the current schedule to all employees. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-[#2563EB] hover:bg-[#1d4ed8]">Publish Schedule</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
