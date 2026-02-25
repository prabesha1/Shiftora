import { useEffect, useState } from 'react';
import { LandingPage } from './components/landing-page';
import { LoginPage } from './components/login-page';
import { ManagerDashboard } from './components/manager-dashboard';
import { EmployeeDashboard } from './components/employee-dashboard';
import { WagesReport } from './components/wages-report';
import { AdminDashboard } from './components/admin-dashboard';
import { User, loadStoredUser, storeUser } from './api/client';

type Page = 'landing' | 'login' | 'signup' | 'manager' | 'employee' | 'wages' | 'admin';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [user, setUser] = useState<User | null>(loadStoredUser());

  useEffect(() => {
    if (user) {
      storeUser(user);
      setCurrentPage(user.role === 'admin' ? 'admin' : user.role === 'manager' ? 'manager' : 'employee');
    }
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    storeUser(null);
    setCurrentPage('landing');
  };

  const handleLoginSuccess = (nextUser: User) => {
    setUser(nextUser);
    setCurrentPage(nextUser.role === 'admin' ? 'admin' : nextUser.role === 'manager' ? 'manager' : 'employee');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {currentPage === 'landing' && <LandingPage onNavigate={setCurrentPage} />}
      {currentPage === 'login' && <LoginPage mode="login" onNavigate={setCurrentPage} onLoginSuccess={handleLoginSuccess} />}
      {currentPage === 'signup' && <LoginPage mode="signup" onNavigate={setCurrentPage} onLoginSuccess={handleLoginSuccess} />}
      {currentPage === 'manager' && user && <ManagerDashboard onNavigate={setCurrentPage} onLogout={handleLogout} user={user} />}
      {currentPage === 'employee' && user && <EmployeeDashboard onNavigate={setCurrentPage} onLogout={handleLogout} user={user} />}
      {currentPage === 'wages' && user && <WagesReport onNavigate={setCurrentPage} user={user} />}
      {currentPage === 'admin' && user && <AdminDashboard onNavigate={setCurrentPage} onLogout={handleLogout} user={user} />}
    </div>
  );
}
