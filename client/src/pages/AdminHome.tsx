import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Props {
  user: { id: number; username: string; name: string; role: string; building?: string | null };
}

interface Task {
  id: number;
  admin_id: number;
  building: string;
  floor: number;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

const statusLabel: Record<string, string> = {
  pending: '待查寝',
  in_progress: '进行中',
  completed: '已完成',
};

export default function AdminHome({ user }: Props) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadTasks();
  }, [filter]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter) params.status = filter;
      const data = await api.getTasks(params);
      setTasks(data.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.start_time.startsWith(todayStr));
  const pendingTasks = todayTasks.filter(t => t.status === 'pending');
  const inProgressTasks = todayTasks.filter(t => t.status === 'in_progress');
  const completedToday = todayTasks.filter(t => t.status === 'completed');

  return (
    <div className="page-container">
      <div className="flex-between" style={{ marginBottom: '20px' }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>宿管工作台</h2>
        <button className="btn btn-primary" onClick={() => navigate('/create-task')}>+ 创建查寝任务</button>
      </div>

      {/* Today's summary cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="stat-card stat-blue">
          <div className="num">{todayTasks.length}</div>
          <div className="label">今日任务</div>
        </div>
        <div className="stat-card stat-orange">
          <div className="num">{pendingTasks.length}</div>
          <div className="label">待查寝</div>
        </div>
        <div className="stat-card stat-blue">
          <div className="num">{inProgressTasks.length}</div>
          <div className="label">进行中</div>
        </div>
        <div className="stat-card stat-green">
          <div className="num">{completedToday.length}</div>
          <div className="label">已完成</div>
        </div>
      </div>

      {/* Pending tasks - prominent */}
      {pendingTasks.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#fa8c16' }}>今日待查任务</h3>
          {pendingTasks.map(task => (
            <div key={task.id} className="task-card" onClick={() => navigate(`/task/${task.id}`)}>
              <div className="task-header">
                <span style={{ fontWeight: 600, fontSize: '15px' }}>{task.building} - {task.floor}楼</span>
                <span className="badge badge-pending">待查寝</span>
              </div>
              <div className="task-meta">
                <span>查寝时段：{new Date(task.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.end_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>点击开始查寝 &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In progress tasks */}
      {inProgressTasks.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#1890ff' }}>正在进行</h3>
          {inProgressTasks.map(task => (
            <div key={task.id} className="task-card" style={{ borderLeftColor: '#1890ff' }} onClick={() => navigate(`/task/${task.id}`)}>
              <div className="task-header">
                <span style={{ fontWeight: 600, fontSize: '15px' }}>{task.building} - {task.floor}楼</span>
                <span className="badge badge-in_progress">进行中</span>
              </div>
              <div className="task-meta">
                <span>查寝时段：{new Date(task.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.end_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>继续查寝 &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All tasks history */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: '12px' }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}>历史任务</h3>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: '6px', fontSize: '13px' }}>
            <option value="">全部状态</option>
            <option value="pending">待查寝</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: '30px' }}>加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px' }}>
            <p>暂无任务</p>
          </div>
        ) : (
          <div style={{ padding: 0 }}>
            {tasks.map(task => (
              <div
                key={task.id}
                className="task-card"
                style={{ borderLeftColor: task.status === 'completed' ? '#52c41a' : task.status === 'in_progress' ? '#1890ff' : '#fa8c16' }}
                onClick={() => navigate(`/task/${task.id}`)}
              >
                <div className="task-header">
                  <span style={{ fontWeight: 600 }}>{task.building} - {task.floor}楼</span>
                  <span className={`badge badge-${task.status}`}>{statusLabel[task.status]}</span>
                </div>
                <div className="task-meta">
                  <span>{new Date(task.start_time).toLocaleDateString('zh-CN')}</span>
                  <span>{new Date(task.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.end_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
