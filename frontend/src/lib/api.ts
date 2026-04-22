import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para injetar o token e gerenciar mocks
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!window.location.pathname.includes('/login')) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      // 401 = token ausente | 403 "Could not validate credentials" = token expirado/inválido
      const isSessionExpired =
        status === 401 ||
        (status === 403 && detail === 'Could not validate credentials');

      if (isSessionExpired) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
