import { useState } from 'react';
import { LandingPage } from './components/landing-page';
import { LoginPage } from './components/login-page';
import { ManagerDashboard } from './components/manager-dashboard';
import { EmployeeDashboard } from './components/employee-dashboard';
import { WagesReport } from './components/wages-report';
import { AdminDashboard } from './components/admin-dashboard';

type Page = 'landing' | 'login' | 'manager' | 'employee' | 'wages' | 'admin';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {currentPage === 'landing' && <LandingPage onNavigate={setCurrentPage} />}
      {currentPage === 'login' && <LoginPage onNavigate={setCurrentPage} />}
      {currentPage === 'manager' && <ManagerDashboard onNavigate={setCurrentPage} />}
      {currentPage === 'employee' && <EmployeeDashboard onNavigate={setCurrentPage} />}
      {currentPage === 'wages' && <WagesReport onNavigate={setCurrentPage} />}
      {currentPage === 'admin' && <AdminDashboard onNavigate={setCurrentPage} />}
    </div>
  );
}