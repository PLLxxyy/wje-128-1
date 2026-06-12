import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import StudentHome from './pages/StudentHome';
import AdminHome from './pages/AdminHome';
import AdminTaskDetail from './pages/AdminTaskDetail';
import AdminCreateTask from './pages/AdminCreateTask';
import CounselorHome from './pages/CounselorHome';
import Header from './pages/Header';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  building?: string | null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = useCallback((token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  if (loading) return null;

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Header user={user} onLogout={handleLogout} />
      <Routes>
        {user.role === 'student' && (
          <>
            <Route path="/" element={<StudentHome user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
        {user.role === 'dorm_admin' && (
          <>
            <Route path="/" element={<AdminHome user={user} />} />
            <Route path="/create-task" element={<AdminCreateTask user={user} />} />
            <Route path="/task/:id" element={<AdminTaskDetail user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
        {user.role === 'counselor' && (
          <>
            <Route path="/" element={<CounselorHome user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
