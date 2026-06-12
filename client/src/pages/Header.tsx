import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api';

interface HeaderProps {
  user: { id: number; username: string; name: string; role: string; building?: string | null };
  onLogout: () => void;
}

const roleMap: Record<string, string> = {
  student: '学生',
  dorm_admin: '宿管',
  counselor: '辅导员',
};

export default function Header({ user, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user.role === 'dorm_admin') {
      loadPendingCount();
    }
  }, [user.role, location.pathname]);

  const loadPendingCount = async () => {
    try {
      const data = await api.getPendingLeaveCount();
      setPendingCount(data.count || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const navItemClass = (path: string) => {
    const isActive = location.pathname === path;
    return `nav-item ${isActive ? 'active' : ''}`;
  };

  return (
    <div className="app-header">
      <h1 style={{ cursor: 'pointer', margin: 0 }} onClick={() => navigate('/')}>宿舍查寝系统</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {user.role === 'student' && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className={navItemClass('/')} onClick={() => navigate('/')}>
              我的查寝记录
            </button>
            <button className={navItemClass('/leaves')} onClick={() => navigate('/leaves')}>
              请假申请
            </button>
          </div>
        )}
        {user.role === 'dorm_admin' && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className={navItemClass('/')} onClick={() => navigate('/')}>
              宿管工作台
            </button>
            <button className={navItemClass('/leaves')} onClick={() => navigate('/leaves')} style={{ position: 'relative' }}>
              请假审批
              {pendingCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-8px',
                  background: '#ff4d4f',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
      <div className="user-info">
        <span>{user.name}（{roleMap[user.role] || user.role}）</span>
        {user.building && <span>楼栋：{user.building}</span>}
        <button
          className="btn btn-outline"
          style={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', fontSize: '13px', padding: '4px 12px' }}
          onClick={onLogout}
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
