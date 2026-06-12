import { useState } from 'react';
import { api } from '../api';

interface LoginPageProps {
  onLogin: (token: string, user: any) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [building, setBuilding] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await api.login(username, password);
        onLogin(data.token, data.user);
      } else {
        const data = await api.register({ username, password, name, role, building: building || undefined });
        onLogin(data.token, data.user);
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>宿舍查寝系统</h2>
        <p className="subtitle">大学宿舍智能管理平台</p>

        <div className="login-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>登录</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>注册</button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>

          {mode === 'register' && (
            <>
              <div className="form-group">
                <label>姓名</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="请输入真实姓名"
                  required
                />
              </div>

              <div className="form-group">
                <label>角色</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="student">学生</option>
                  <option value="dorm_admin">宿管</option>
                  <option value="counselor">辅导员</option>
                </select>
              </div>

              {(role === 'dorm_admin' || role === 'counselor') && (
                <div className="form-group">
                  <label>管辖楼栋</label>
                  <input
                    type="text"
                    value={building}
                    onChange={e => setBuilding(e.target.value)}
                    placeholder="如：1号楼"
                  />
                </div>
              )}
            </>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '16px' }} disabled={loading}>
            {loading ? '处理中...' : mode === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        <div style={{ marginTop: '20px', fontSize: '13px', color: '#999', textAlign: 'center' }}>
          <div>测试账号：</div>
          <div>学生 test / 123456 &nbsp; 宿管 admin / 123456 &nbsp; 辅导员 counselor / 123456</div>
        </div>
      </div>
    </div>
  );
}
