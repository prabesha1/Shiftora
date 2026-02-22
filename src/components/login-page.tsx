import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type Props = {
  onNavigate: (page: string) => void;
};

export function LoginPage({ onNavigate }: Props) {
  const [role, setRole] = useState<string>('manager');

  const handleLogin = () => {
    if (role === 'admin') {
      onNavigate('admin');
    } else if (role === 'manager') {
      onNavigate('manager');
    } else {
      onNavigate('employee');
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
            <h1 className="text-3xl">Welcome back</h1>
            <p className="text-gray-600">
              Log in to manage shifts, swaps, and daily wages & tips.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@restaurant.com"
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"
                className="rounded-xl h-11"
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
            >
              Log in
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 pt-4">
            Having trouble? Contact your manager or admin.
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