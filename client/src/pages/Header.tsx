import { useNavigate } from 'react-router-dom';

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

  return (
    <div className="app-header">
      <h1 style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>宿舍查寝系统</h1>
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
