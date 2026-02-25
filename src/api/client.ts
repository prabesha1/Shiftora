const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  token: string;
};

const request = async <T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: any,
  token?: string
): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Request failed');
  }
  return res.json();
};

export const api = {
  login: (email: string, password: string) =>
    request<User>('/api/auth/login', 'POST', { email, password }),
  register: (payload: { name: string; email: string; password: string; role: string }) =>
    request<User>('/api/auth/register', 'POST', payload),

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
