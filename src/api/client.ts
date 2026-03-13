// In dev, use '' so Vite proxy forwards /api to backend. Otherwise use env or default.
const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? '' : 'http://localhost:4000');

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  token: string;
};

export type Request = {
  _id: string;
  employee: string;
  employeeId?: string;
  shift: string;
  role: string;
  reason: string;
  type: 'swap' | 'leave';
  status: 'pending' | 'approved' | 'declined';
  managerNote?: string;
  createdAt: string;
};

const REQUEST_TIMEOUT_MS = 15000;

const request = async <T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: any,
  token?: string
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      let msg = text;
      try {
        const json = JSON.parse(text);
        if (json.message) msg = json.message;
      } catch { /* ignore */ }
      throw new Error(msg || 'Request failed');
    }
    return res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Is the server running at ' + API_BASE + '?');
    }
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      throw new Error('Cannot reach server. Start the API with: cd server && node index.js');
    }
    throw err;
  }
};

export const api = {
  login: (email: string, password: string) =>
    request<User>('/api/auth/login', 'POST', { email, password }),
  register: (payload: { name: string; email: string; password: string; role: string }) =>
    request<User>('/api/auth/register', 'POST', payload),
  changePassword: (currentPassword: string, newPassword: string, token?: string) =>
    request('/api/auth/change-password', 'PATCH', { currentPassword, newPassword }, token),

  getProfile: (token?: string) => request<{ name: string; email: string; dob?: string; address?: string; phone?: string; employeeId?: string }>('/api/profile', 'GET', undefined, token),
  updateProfile: (data: { name?: string; dob?: string; address?: string; phone?: string }, token?: string) =>
    request('/api/profile', 'PATCH', data, token),

  getEmployees: (token?: string) => request('/api/employees', 'GET', undefined, token),
  createEmployee: (data: any, token?: string) => request('/api/employees', 'POST', data, token),
  updateEmployee: (id: string, data: any, token?: string) =>
    request(`/api/employees/${id}`, 'PATCH', data, token),
  deleteEmployee: (id: string, token?: string) =>
    request(`/api/employees/${id}`, 'DELETE', undefined, token),

  getShifts: (params: { employeeId?: string; start?: string; end?: string } = {}, token?: string) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/api/shifts${query ? `?${query}` : ''}`, 'GET', undefined, token);
  },
  createShift: (data: any, token?: string) => request('/api/shifts', 'POST', data, token),
  deleteShift: (id: string, token?: string) =>
    request(`/api/shifts/${id}`, 'DELETE', undefined, token),

  getTips: (date?: string, token?: string) =>
    request(`/api/tips${date ? `?date=${date}` : ''}`, 'GET', undefined, token),
  createTip: (data: any, token?: string) => request('/api/tips', 'POST', data, token),

  getPunches: (params: { employeeId?: string } = {}, token?: string) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/api/punches${query ? `?${query}` : ''}`, 'GET', undefined, token);
  },
  clockIn: (data: any, token?: string) => request('/api/punches/clock-in', 'POST', data, token),
  clockOut: (data: any, token?: string) => request('/api/punches/clock-out', 'POST', data, token),
  breakStart: (data: any, token?: string) => request('/api/punches/break-start', 'POST', data, token),
  breakEnd: (data: any, token?: string) => request('/api/punches/break-end', 'POST', data, token),

  getDailyReport: (date: string, token?: string) =>
    request(`/api/reports/daily?date=${date}`, 'GET', undefined, token),
  getOverviewReport: (token?: string) => request('/api/reports/overview', 'GET', undefined, token),
  getEmployeeWeekly: (employeeId: string, periods = 1, token?: string, email?: string) => {
    const params = new URLSearchParams({ employeeId, periods: String(periods) });
    if (email) params.set('email', email);
    return request(`/api/reports/employee/weekly?${params.toString()}`, 'GET', undefined, token);
  },

  // Requests (swap/leave)
  getRequests: (status?: string, token?: string) =>
    request<Request[]>(`/api/requests${status ? `?status=${status}` : ''}`, 'GET', undefined, token),
  createRequest: (data: any, token?: string) => request<Request>('/api/requests', 'POST', data, token),
  updateRequest: (id: string, data: { status: string; managerNote?: string }, token?: string) =>
    request(`/api/requests/${id}`, 'PATCH', data, token),
};

export const loadStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem('shiftora_user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

export const storeUser = (user: User | null) => {
  if (!user) {
    localStorage.removeItem('shiftora_user');
    return;
  }
  localStorage.setItem('shiftora_user', JSON.stringify(user));
};
