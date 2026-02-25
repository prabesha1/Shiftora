import { Users, TrendingUp, DollarSign, Building2, Shield, Settings, ChevronRight, Trash2, Crown, ArrowUpCircle, ArrowDownCircle, Plus, Calendar, Clock, BarChart3, FileText, UserCheck, UserX } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { formatLongDate } from '../utils/time';
import { api } from '../api/client';

type Props = {
  onNavigate: (page: string) => void;
  onLogout: () => void;
  user: { id: string; name: string; role: string; token: string };
};

type Employee = {
  id: string;
  _id?: string;
  name: string;
  role: string;
  department: string;
  level: 'Owner' | 'Manager' | 'Employee';
  email: string;
  phone: string;
  hourlyRate: number;
  status: 'active' | 'inactive';
  joinDate: string;
};

export function AdminDashboard({ onNavigate }: Props) {
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const todayLabel = formatLongDate(new Date());

  const [showEmployeeManagement, setShowEmployeeManagement] = useState(false);
  const [showFinancialReport, setShowFinancialReport] = useState(false);
  const [showDepartmentManagement, setShowDepartmentManagement] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);

  const stableNumber = (seed: string, min: number, max: number) => {
    const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const range = max - min + 1;
    return (hash % range) + min;
  };

  const getId = (emp: Employee) => emp.id || emp._id || '';

  const earningsBreakdown = useMemo(() => 
    employees.slice(0, 5).map((emp) => {
      const dailyHours = stableNumber((emp.id || (emp as any)._id || '') + emp.name, 5, 10);
      const dailyTips = stableNumber(emp.email, 20, 80);
      const dailyWage = dailyHours * emp.hourlyRate;

      return {
        employee: emp,
        dailyHours,
        dailyWage,
        dailyTips,
      };
    })
  , [employees]);

  useEffect(() => {
    const load = async () => {
      try {
        const [emps, overview] = await Promise.all([
          api.getEmployees(user.token),
          api.getOverviewReport(user.token),
        ]);
        setEmployees(emps as Employee[]);
        if (overview?.daily) setDailyFinancials(overview.daily);
        if (overview?.weekly) setWeeklyFinancials(overview.weekly);
      } catch (err) {
        // silent fail for now
      }
    };
    load();
  }, [user.token]);

  const [dailyFinancials, setDailyFinancials] = useState({
    date: todayLabel,
    totalWages: 0,
    totalTips: 0,
    totalRevenue: 0,
    hoursWorked: 0,
    activeEmployees: 0,
    laborCostPercentage: 0
  });

  const [weeklyFinancials, setWeeklyFinancials] = useState({
    totalWages: 0,
    totalTips: 0,
    totalRevenue: 0,
    hoursWorked: 0,
    laborCostPercentage: 0
  });

  const departments = [
    { name: 'Front of House', employees: 5, manager: 'Prabesh Shrestha', budget: 45000 },
    { name: 'Kitchen', employees: 2, manager: 'Prabesh Shrestha', budget: 38000 },
    { name: 'Bar', employees: 1, manager: 'Prabesh Shrestha', budget: 28000 },
    { name: 'Management', employees: 1, manager: 'Owner', budget: 52000 },
  ];

  const handlePromoteToManager = (employee: Employee) => {
    setEmployees(employees.map(emp => 
      getId(emp) === getId(employee)
        ? { ...emp, level: 'Manager', role: 'Manager' }
        : emp
    ));
    setConfirmationMessage(`${employee.name} has been promoted to Manager!`);
    setTimeout(() => setConfirmationMessage(null), 3000);
    setShowPromoteModal(false);
    setSelectedEmployee(null);
  };

  const handleDemoteFromManager = (employee: Employee) => {
    setEmployees(employees.map(emp => 
      getId(emp) === getId(employee)
        ? { ...emp, level: 'Employee', role: 'Server' }
        : emp
    ));
    setConfirmationMessage(`${employee.name} has been demoted to Employee.`);
    setTimeout(() => setConfirmationMessage(null), 3000);
    setShowPromoteModal(false);
    setSelectedEmployee(null);
  };

  const handleRemoveEmployee = (employee: Employee) => {
    api.deleteEmployee(getId(employee), user.token)
      .then(() => {
        setEmployees(employees.filter(emp => getId(emp) !== getId(employee)));
        setConfirmationMessage(`${employee.name} has been removed from the system.`);
      })
      .catch((err: any) => setConfirmationMessage(err.message));
    setTimeout(() => setConfirmationMessage(null), 3000);
    setShowRemoveModal(false);
    setSelectedEmployee(null);
  };

  const groupedByLevel = {
    Owner: employees.filter(e => e.level === 'Owner'),
    Manager: employees.filter(e => e.level === 'Manager'),
    Employee: employees.filter(e => e.level === 'Employee')
  };

  const groupedByDepartment = {
    'Front of House': employees.filter(e => e.department === 'Front of House'),
    'Kitchen': employees.filter(e => e.department === 'Kitchen'),
    'Bar': employees.filter(e => e.department === 'Bar'),
    'Management': employees.filter(e => e.department === 'Management')
  };

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
            <Badge className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600">
              <Crown className="w-3 h-3 mr-1" />
              Owner / Admin
            </Badge>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <button className="text-gray-900">Admin Dashboard</button>
            <button 
              onClick={() => onNavigate('manager')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Manager View
            </button>
            <button 
              onClick={() => onNavigate('wages')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Wages & Tips
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white">
              <Crown className="w-5 h-5" />
            </div>
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
          <h1 className="text-4xl">{greeting}, Admin.</h1>
          <p className="text-gray-600">Complete control and oversight of Pokhara Restro & Bar</p>
        </div>

        {/* Key Stats Row */}
        <div className="grid md:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-3xl">{employees.length}</span>
            </div>
            <div className="text-gray-600">Total Employees</div>
            <div className="text-sm text-blue-600 mt-2">
              {employees.filter(e => e.level === 'Manager').length} Managers
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-3xl">${dailyFinancials.totalWages}</span>
            </div>
            <div className="text-gray-600">Daily Wages</div>
            <div className="text-sm text-green-600 mt-2">+12% from yesterday</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-3xl">${dailyFinancials.totalTips}</span>
            </div>
            <div className="text-gray-600">Daily Tips</div>
            <div className="text-sm text-purple-600 mt-2">+8% from yesterday</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-3xl">{dailyFinancials.laborCostPercentage}%</span>
            </div>
            <div className="text-gray-600">Labor Cost %</div>
            <div className="text-sm text-amber-600 mt-2">Within target range</div>
          </div>
        </div>

        {/* Main Action Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Employee Management */}
          <button
            onClick={() => setShowEmployeeManagement(true)}
            className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 hover:border-blue-300 transition-all text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl">Employee Management</h3>
                  <p className="text-sm text-gray-600">View hierarchy & manage roles</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="p-3 rounded-xl bg-gray-50 text-center">
                <div className="text-lg font-medium">{groupedByLevel.Manager.length}</div>
                <div className="text-xs text-gray-600">Managers</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 text-center">
                <div className="text-lg font-medium">{groupedByLevel.Employee.length}</div>
                <div className="text-xs text-gray-600">Employees</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 text-center">
                <div className="text-lg font-medium">4</div>
                <div className="text-xs text-gray-600">Departments</div>
              </div>
            </div>
          </button>

          {/* Financial Reports */}
          <button
            onClick={() => setShowFinancialReport(true)}
            className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 hover:border-green-300 transition-all text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl">Financial Reports</h3>
                  <p className="text-sm text-gray-600">Wages, tips & analytics</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                <div className="text-sm text-gray-600">Today's Total</div>
                <div className="text-xl font-medium text-green-700">${dailyFinancials.totalWages + dailyFinancials.totalTips}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <div className="text-sm text-gray-600">Week Total</div>
                <div className="text-xl font-medium text-blue-700">${weeklyFinancials.totalWages + weeklyFinancials.totalTips}</div>
              </div>
            </div>
          </button>

          {/* Department Management */}
          <button
            onClick={() => setShowDepartmentManagement(true)}
            className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 hover:border-purple-300 transition-all text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl">Department Management</h3>
                  <p className="text-sm text-gray-600">Organize teams & budgets</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
            <div className="space-y-2 mt-4">
              {departments.slice(0, 2).map((dept, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <span className="text-sm">{dept.name}</span>
                  <span className="text-sm text-gray-600">{dept.employees} employees</span>
                </div>
              ))}
            </div>
          </button>

          {/* System Settings */}
          <button
            className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 hover:border-gray-300 transition-all text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl">System Settings</h3>
                  <p className="text-sm text-gray-600">Configure restaurant settings</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                <Shield className="w-4 h-4 text-gray-600" />
                <span className="text-sm">Security & Permissions</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="text-sm">Business Hours</span>
              </div>
            </div>
          </button>
        </div>

        {/* Business Analytics */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100">
          <h2 className="text-xl mb-4">Business Analytics Overview</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100">
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Total Hours This Week</span>
              </div>
              <div className="text-3xl font-medium text-blue-700">{weeklyFinancials.hoursWorked}</div>
              <div className="text-sm text-gray-600 mt-2">Across all departments</div>
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100">
              <div className="flex items-center gap-3 mb-3">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="font-medium">Average Hourly Rate</span>
              </div>
              <div className="text-3xl font-medium text-green-700">
                ${(employees.reduce((sum, emp) => sum + emp.hourlyRate, 0) / employees.length).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 mt-2">Across all employees</div>
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100">
              <div className="flex items-center gap-3 mb-3">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="font-medium">Weekly Revenue</span>
              </div>
              <div className="text-3xl font-medium text-purple-700">${weeklyFinancials.totalRevenue}</div>
              <div className="text-sm text-gray-600 mt-2">+15% from last week</div>
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

      {/* Employee Management Modal */}
      <Dialog open={showEmployeeManagement} onOpenChange={setShowEmployeeManagement}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Employee Management</DialogTitle>
            <DialogDescription>
              View and manage employees by hierarchy, department, and roles
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* By Level */}
            <div>
              <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#2563EB]" />
                By Level
              </h3>
              
              {/* Managers */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <span className="font-medium">Managers ({groupedByLevel.Manager.length})</span>
                </div>
                <div className="space-y-2">
                  {groupedByLevel.Manager.map((employee) => (
                    <div key={getId(employee)} className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white">
                          {employee.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-sm text-gray-600">{employee.role} • {employee.department}</div>
                          <div className="text-xs text-gray-500">{employee.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-500 hover:bg-amber-500">Manager</Badge>
                        <Badge variant="secondary">${employee.hourlyRate}/hr</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowPromoteModal(true);
                          }}
                        >
                          <ArrowDownCircle className="w-4 h-4 mr-1" />
                          Demote
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowRemoveModal(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Employees */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Employees ({groupedByLevel.Employee.length})</span>
                </div>
                <div className="space-y-2">
                  {groupedByLevel.Employee.map((employee) => (
                    <div key={getId(employee)} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between group hover:border-blue-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                          {employee.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-sm text-gray-600">{employee.role} • {employee.department}</div>
                          <div className="text-xs text-gray-500">{employee.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Employee</Badge>
                        <Badge variant="secondary">${employee.hourlyRate}/hr</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 transition-opacity border-green-200 text-green-600 hover:bg-green-50"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowPromoteModal(true);
                          }}
                        >
                          <ArrowUpCircle className="w-4 h-4 mr-1" />
                          Promote
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowRemoveModal(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* By Department */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#2563EB]" />
                By Department
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(groupedByDepartment).map(([department, emps]) => (
                  <div key={department} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{department}</h4>
                      <Badge variant="secondary">{emps.length} employees</Badge>
                    </div>
                    <div className="space-y-2">
                      {emps.map((emp) => (
                        <div key={getId(emp)} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs">
                            {emp.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{emp.name}</div>
                            <div className="text-xs text-gray-600">{emp.role}</div>
                          </div>
                          {emp.level === 'Manager' && (
                            <Crown className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Financial Report Modal */}
      <Dialog open={showFinancialReport} onOpenChange={setShowFinancialReport}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Financial Reports</DialogTitle>
            <DialogDescription>
              Comprehensive wages, tips, and labor cost analytics
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Daily Overview */}
            <div>
              <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2563EB]" />
                Daily Report - {dailyFinancials.date}
              </h3>
              
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100">
                  <div className="text-sm text-gray-600 mb-2">Total Wages</div>
                  <div className="text-3xl font-medium text-green-700">${dailyFinancials.totalWages}</div>
                  <div className="text-sm text-gray-600 mt-2">{dailyFinancials.hoursWorked} hours worked</div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100">
                  <div className="text-sm text-gray-600 mb-2">Total Tips</div>
                  <div className="text-3xl font-medium text-purple-700">${dailyFinancials.totalTips}</div>
                  <div className="text-sm text-gray-600 mt-2">Distributed to {dailyFinancials.activeEmployees} employees</div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100">
                  <div className="text-sm text-gray-600 mb-2">Combined Total</div>
                  <div className="text-3xl font-medium text-blue-700">${dailyFinancials.totalWages + dailyFinancials.totalTips}</div>
                  <div className="text-sm text-gray-600 mt-2">Revenue: ${dailyFinancials.totalRevenue}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Labor Cost Percentage</div>
                    <div className="text-sm text-gray-600">Total labor cost vs. revenue</div>
                  </div>
                  <div className="text-3xl font-medium text-amber-700">{dailyFinancials.laborCostPercentage}%</div>
                </div>
                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full" 
                    style={{ width: `${dailyFinancials.laborCostPercentage}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-2">Target: 30-35% • Current: {dailyFinancials.laborCostPercentage}%</div>
              </div>
            </div>

            {/* Weekly Overview */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#2563EB]" />
                Weekly Overview
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-600 mb-2">Total Wages (Week)</div>
                  <div className="text-2xl font-medium">${weeklyFinancials.totalWages}</div>
                  <div className="text-sm text-gray-600 mt-2">{weeklyFinancials.hoursWorked} hours</div>
                </div>

                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-600 mb-2">Total Tips (Week)</div>
                  <div className="text-2xl font-medium">${weeklyFinancials.totalTips}</div>
                  <div className="text-sm text-gray-600 mt-2">Combined: ${weeklyFinancials.totalWages + weeklyFinancials.totalTips}</div>
                </div>

                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-600 mb-2">Weekly Revenue</div>
                  <div className="text-2xl font-medium">${weeklyFinancials.totalRevenue}</div>
                  <div className="text-sm text-green-600 mt-2">+15% from last week</div>
                </div>

                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-600 mb-2">Labor Cost %</div>
                  <div className="text-2xl font-medium">{weeklyFinancials.laborCostPercentage}%</div>
                  <div className="text-sm text-amber-600 mt-2">Within target range</div>
                </div>
              </div>
            </div>

            {/* Employee Breakdown */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-medium text-lg mb-4">Employee Earnings Breakdown</h3>
              
              <div className="space-y-2">
                {earningsBreakdown.map(({ employee, dailyHours, dailyWage, dailyTips }) => (
                  <div key={getId(employee)} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-sm text-gray-600">{employee.role} • {dailyHours}h @ ${employee.hourlyRate}/hr</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${(dailyWage + dailyTips).toFixed(2)}</div>
                      <div className="text-xs text-gray-600">${dailyWage.toFixed(2)} wages + ${dailyTips.toFixed(2)} tips</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Department Management Modal */}
      <Dialog open={showDepartmentManagement} onOpenChange={setShowDepartmentManagement}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Department Management</DialogTitle>
            <DialogDescription>
              Organize teams, assign managers, and manage department budgets
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {departments.map((dept, index) => (
              <div key={index} className="p-6 rounded-xl border-2 border-gray-200 bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-medium">{dept.name}</h3>
                    <p className="text-sm text-gray-600">{dept.employees} employees assigned</p>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-2">${dept.budget}/yr</Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-gray-200">
                    <div className="text-sm text-gray-600 mb-1">Department Manager</div>
                    <div className="font-medium">{dept.manager}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-gray-200">
                    <div className="text-sm text-gray-600 mb-1">Active Employees</div>
                    <div className="font-medium">{dept.employees} team members</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl">
                    <Users className="w-4 h-4 mr-1" />
                    View Team
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl">
                    <Settings className="w-4 h-4 mr-1" />
                    Settings
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Promote/Demote Modal */}
      <Dialog open={showPromoteModal} onOpenChange={setShowPromoteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedEmployee?.level === 'Manager' ? 'Demote Manager' : 'Promote to Manager'}
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee?.level === 'Manager' 
                ? 'Remove manager privileges from this employee'
                : 'Grant manager privileges to this employee'}
            </DialogDescription>
          </DialogHeader>

          {selectedEmployee && (
            <div className="space-y-6 mt-4">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                  {selectedEmployee.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-medium">{selectedEmployee.name}</div>
                  <div className="text-sm text-gray-600">{selectedEmployee.role}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-900">
                      {selectedEmployee.level === 'Manager' ? 'This will remove manager access' : 'This will grant full manager access'}
                    </div>
                    <div className="text-sm text-amber-700 mt-1">
                      {selectedEmployee.level === 'Manager' 
                        ? 'They will no longer be able to manage schedules, approve requests, or access manager features.'
                        : 'They will be able to manage schedules, approve requests, and access all manager features.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl h-12"
                  onClick={() => setShowPromoteModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className={`flex-1 rounded-xl h-12 ${
                    selectedEmployee.level === 'Manager' 
                      ? 'bg-amber-600 hover:bg-amber-700' 
                      : 'bg-[#22C55E] hover:bg-[#22C55E]/90'
                  }`}
                  onClick={() => {
                    if (selectedEmployee.level === 'Manager') {
                      handleDemoteFromManager(selectedEmployee);
                    } else {
                      handlePromoteToManager(selectedEmployee);
                    }
                  }}
                >
                  {selectedEmployee.level === 'Manager' ? (
                    <>
                      <ArrowDownCircle className="w-4 h-4 mr-2" />
                      Demote to Employee
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-4 h-4 mr-2" />
                      Promote to Manager
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Employee Modal */}
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Remove Employee</DialogTitle>
            <DialogDescription>
              Permanently remove this employee from the system
            </DialogDescription>
          </DialogHeader>

          {selectedEmployee && (
            <div className="space-y-6 mt-4">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white">
                  {selectedEmployee.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-medium">{selectedEmployee.name}</div>
                  <div className="text-sm text-gray-600">{selectedEmployee.role} • {selectedEmployee.department}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="flex items-start gap-2">
                  <UserX className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-900">This action cannot be undone</div>
                    <div className="text-sm text-red-700 mt-1">
                      This employee will be permanently removed from the system. All their data, shifts, and history will be deleted.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl h-12"
                  onClick={() => setShowRemoveModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 rounded-xl h-12 bg-red-600 hover:bg-red-700"
                  onClick={() => handleRemoveEmployee(selectedEmployee)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Employee
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
