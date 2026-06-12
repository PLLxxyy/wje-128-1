const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request(url: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (data: { username: string; password: string; name: string; role: string; building?: string }) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => request('/auth/me'),

  getBuildings: () => request('/auth/buildings'),

  // Tasks
  getTasks: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/tasks${qs}`);
  },

  createTask: (data: { building: string; floor: number; start_time: string; end_time: string }) =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTaskDetail: (id: number) => request(`/tasks/${id}`),

  updateRecord: (taskId: number, recordId: number, status: string, note: string) =>
    request(`/tasks/${taskId}/records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, note }),
    }),

  startTask: (id: number) =>
    request(`/tasks/${id}/start`, { method: 'POST' }),

  submitTask: (id: number) =>
    request(`/tasks/${id}/submit`, { method: 'POST' }),

  // Records
  getStudentRecords: () => request('/records/student'),

  // Stats
  getSummary: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/stats/summary${qs}`);
  },

  getAbsentList: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/stats/absent-list${qs}`);
  },

  getFloorRate: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/stats/floor-rate${qs}`);
  },
};
