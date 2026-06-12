import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Props {
  user: { id: number; username: string; name: string; role: string; building?: string | null };
}

export default function AdminCreateTask({ user }: Props) {
  const navigate = useNavigate();
  const [building, setBuilding] = useState(user.building || '');
  const [floor, setFloor] = useState('1');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [buildings, setBuildings] = useState<string[]>([]);

  useEffect(() => {
    loadBuildings();
    // Set default times
    const now = new Date();
    const startH = new Date(now);
    startH.setHours(22, 0, 0, 0);
    const endH = new Date(now);
    endH.setHours(23, 0, 0, 0);
    setStartTime(formatDateTimeLocal(startH));
    setEndTime(formatDateTimeLocal(endH));
  }, []);

  const loadBuildings = async () => {
    try {
      const data = await api.getBuildings();
      setBuildings(data.buildings);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDateTimeLocal = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.createTask({
        building,
        floor: parseInt(floor),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
      });
      navigate(`/task/${data.task.id}`);
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '560px' }}>
      <h2 className="page-title">创建查寝任务</h2>

      <div className="card">
        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>楼栋</label>
            {buildings.length > 0 ? (
              <select value={building} onChange={e => setBuilding(e.target.value)} required>
                <option value="">请选择楼栋</option>
                {buildings.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={building}
                onChange={e => setBuilding(e.target.value)}
                placeholder="如：1号楼"
                required
              />
            )}
          </div>

          <div className="form-group">
            <label>楼层</label>
            <select value={floor} onChange={e => setFloor(e.target.value)} required>
              <option value="1">1楼</option>
              <option value="2">2楼</option>
              <option value="3">3楼</option>
              <option value="4">4楼</option>
              <option value="5">5楼</option>
              <option value="6">6楼</option>
            </select>
          </div>

          <div className="form-group">
            <label>查寝开始时间</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>查寝结束时间</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? '创建中...' : '创建任务'}
            </button>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/')}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
