import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { api } from '../api/client';

type Props = {
  onNavigate: (page: string) => void;
  onLoginSuccess: (user: any) => void;
  mode?: 'login' | 'signup';
};

export function LoginPage({ onNavigate, onLoginSuccess, mode = 'login' }: Props) {
  const [role, setRole] = useState<string>('manager');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = mode === 'signup'
        ? await api.register({ name, email, password, role })
        : await api.login(email, password);
      if (role && user.role !== role) {
        setError(`User role mismatch. Your account is ${user.role}.`);
        setLoading(false);
        return;
      }
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl tracking-tight">
              <span className="font-semibold text-[#2563EB]">Shift</span><span className="text-black">ora</span>
            </span>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
            <p className="text-gray-600">
              {mode === 'signup'
                ? 'Set up your Shiftora access.'
                : 'Log in to manage shifts, swaps, and daily wages & tips.'}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jane Doe"
                  className="rounded-xl h-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@restaurant.com"
                className="rounded-xl h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"
                className="rounded-xl h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleLogin}
              className="w-full rounded-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8] mt-6"
              disabled={loading}
            >
              {loading ? (mode === 'signup' ? 'Creating…' : 'Logging in…') : mode === 'signup' ? 'Create account' : 'Log in'}
            </Button>

            {error && <div className="text-sm text-red-600 text-center">{error}</div>}
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 pt-4">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button className="text-[#2563EB]" onClick={() => onNavigate('login')}>Log in</button>
              </>
            ) : (
              <>
                New here?{' '}
                <button className="text-[#2563EB]" onClick={() => onNavigate('signup')}>Create an account</button>
              </>
            )}
          </div>
        </div>

        {/* Back to home link */}
        <div className="text-center mt-6">
          <button 
            onClick={() => onNavigate('landing')}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
