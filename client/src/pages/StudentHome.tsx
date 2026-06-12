import { useState, useEffect } from 'react';
import { api } from '../api';

interface Props {
  user: { id: number; username: string; name: string; role: string };
}

interface StudentRecord {
  id: number;
  task_id: number;
  status: string;
  note: string;
  checked_at: string;
  building: string;
  floor: number;
  room_number: string;
  start_time: string;
  end_time: string;
  task_status: string;
}

const statusText: Record<string, string> = {
  present: '已到',
  absent: '缺勤',
  unchecked: '未点名',
};

export default function StudentHome({ user }: Props) {
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const data = await api.getStudentRecords();
      setRecords(data.records);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const completedRecords = records.filter(r => r.task_status === 'completed');

  // Stats
  const totalChecks = completedRecords.length;
  const presentCount = completedRecords.filter(r => r.status === 'present').length;
  const absentCount = completedRecords.filter(r => r.status === 'absent').length;

  return (
    <div className="page-container">
      <h2 className="page-title">我的查寝记录</h2>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="stat-card stat-blue">
          <div className="num">{totalChecks}</div>
          <div className="label">查寝总次数</div>
        </div>
        <div className="stat-card stat-green">
          <div className="num">{presentCount}</div>
          <div className="label">在寝次数</div>
        </div>
        <div className="stat-card stat-red">
          <div className="num">{absentCount}</div>
          <div className="label">缺勤次数</div>
        </div>
        <div className="stat-card stat-orange">
          <div className="num">{totalChecks > 0 ? ((presentCount / totalChecks) * 100).toFixed(0) : 0}%</div>
          <div className="label">到寝率</div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">加载中...</div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <div className="icon">&#128203;</div>
          <p>暂无查寝记录</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>查寝日期</th>
                <th>楼栋</th>
                <th>楼层</th>
                <th>寝室号</th>
                <th>状态</th>
                <th>备注</th>
                <th>任务状态</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.start_time).toLocaleDateString('zh-CN')}</td>
                  <td>{r.building}</td>
                  <td>{r.floor}楼</td>
                  <td>{r.room_number}</td>
                  <td className={`status-${r.status}`}>
                    {r.status === 'absent' ? <strong>缺勤</strong> : statusText[r.status] || r.status}
                  </td>
                  <td>{r.note || '-'}</td>
                  <td>
                    <span className={`badge badge-${r.task_status}`}>
                      {r.task_status === 'pending' ? '待查寝' : r.task_status === 'in_progress' ? '进行中' : '已完成'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
