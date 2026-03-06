import { Component, useEffect, useState } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { LandingPage } from './components/landing-page';
import { LoginPage } from './components/login-page';
import { ManagerDashboard } from './components/manager-dashboard';
import { EmployeeDashboard } from './components/employee-dashboard';
import { WagesReport } from './components/wages-report';
import { AdminDashboard } from './components/admin-dashboard';
import { User, loadStoredUser, storeUser } from './api/client';

type Page = 'landing' | 'login' | 'signup' | 'manager' | 'employee' | 'wages' | 'admin';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Shiftora error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#dc2626', marginBottom: 12 }}>Something went wrong</h1>
          <pre style={{ background: '#fef2f2', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 14 }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => {
              localStorage.removeItem('shiftora_user');
              window.location.reload();
            }}
            style={{
              marginTop: 16, padding: '10px 20px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
            }}
          >
            Clear session & reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
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

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
