import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Props {
  user: { id: number; username: string; name: string; role: string };
}

interface TaskDetail {
  id: number;
  building: string;
  floor: number;
  start_time: string;
  end_time: string;
  status: string;
}

interface CheckRecord {
  id: number;
  task_id: number;
  student_id: number;
  room_id: number;
  student_name: string;
  username: string;
  room_number: string;
  building: string;
  floor: number;
  status: string;
  note: string;
  checked_at: string | null;
}

export default function AdminTaskDetail({ user }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [records, setRecords] = useState<CheckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      const data = await api.getTaskDetail(Number(id));
      setTask(data.task);
      setRecords(data.records);
      // Init note map
      const notes: Record<number, string> = {};
      for (const r of data.records) {
        notes[r.id] = r.note || '';
      }
      setEditingNote(notes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async (recordId: number, status: 'present' | 'absent') => {
    const note = editingNote[recordId] || '';
    try {
      await api.updateRecord(Number(id), recordId, status, note);
      setRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, status, note } : r)
      );
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const handleStart = async () => {
    try {
      await api.startTask(Number(id));
      loadTask();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitTask = async () => {
    const uncheckedCount = records.filter(r => r.status === 'unchecked').length;
    if (uncheckedCount > 0) {
      if (!confirm(`还有 ${uncheckedCount} 人未点名，未点名的学生将自动标记为缺勤。确定提交？`)) {
        return;
      }
    }
    setSubmitting(true);
    try {
      await api.submitTask(Number(id));
      loadTask();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-container"><div className="empty-state">加载中...</div></div>;
  if (!task) return <div className="page-container"><div className="empty-state">任务不存在</div></div>;

  // Group records by room
  const roomMap = new Map<string, CheckRecord[]>();
  for (const r of records) {
    const key = r.room_number;
    if (!roomMap.has(key)) roomMap.set(key, []);
    roomMap.get(key)!.push(r);
  }

  const sortedRooms = Array.from(roomMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const checkedCount = records.filter(r => r.status !== 'unchecked').length;
  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;

  const isEditable = task.status !== 'completed';

  return (
    <div className="page-container">
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/')} style={{ marginBottom: '8px' }}>
            &larr; 返回
          </button>
          <h2 className="page-title" style={{ marginBottom: 0 }}>{task.building} - {task.floor}楼 查寝</h2>
        </div>
        <span className={`badge badge-${task.status}`} style={{ fontSize: '14px', padding: '4px 12px' }}>
          {task.status === 'pending' ? '待查寝' : task.status === 'in_progress' ? '进行中' : '已完成'}
        </span>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="task-meta" style={{ marginBottom: '8px' }}>
          <span>查寝时间：{new Date(task.start_time).toLocaleString('zh-CN')} - {new Date(task.end_time).toLocaleTimeString('zh-CN')}</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="stat-card stat-blue" style={{ padding: '12px 20px', minWidth: '100px' }}>
            <div className="num" style={{ fontSize: '22px' }}>{records.length}</div>
            <div className="label">应到人数</div>
          </div>
          <div className="stat-card stat-blue" style={{ padding: '12px 20px', minWidth: '100px' }}>
            <div className="num" style={{ fontSize: '22px' }}>{checkedCount}</div>
            <div className="label">已点名</div>
          </div>
          <div className="stat-card stat-green" style={{ padding: '12px 20px', minWidth: '100px' }}>
            <div className="num" style={{ fontSize: '22px' }}>{presentCount}</div>
            <div className="label">已到</div>
          </div>
          <div className="stat-card stat-red" style={{ padding: '12px 20px', minWidth: '100px' }}>
            <div className="num" style={{ fontSize: '22px' }}>{absentCount}</div>
            <div className="label">缺勤</div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {isEditable && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {task.status === 'pending' && (
            <button className="btn btn-primary" onClick={handleStart}>开始查寝</button>
          )}
          {task.status === 'in_progress' && (
            <button className="btn btn-success" onClick={handleSubmitTask} disabled={submitting}>
              {submitting ? '提交中...' : '提交查寝结果'}
            </button>
          )}
        </div>
      )}

      {/* Room by room check */}
      {sortedRooms.map(([roomNum, roomRecords]) => (
        <div key={roomNum} className="card" style={{ padding: '0' }}>
          <div style={{ padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: '15px' }}>
            {roomNum}寝室
          </div>
          {roomRecords.map(record => (
            <div key={record.id} className="record-row">
              <span className="student-name">{record.student_name}</span>
              <span className="room-info">({record.username})</span>
              <div style={{ flex: 1 }}>
                {isEditable && (
                  <input
                    type="text"
                    placeholder="备注（如：请假回家）"
                    value={editingNote[record.id] || ''}
                    onChange={e => setEditingNote(prev => ({ ...prev, [record.id]: e.target.value }))}
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '13px' }}
                  />
                )}
                {!isEditable && record.note && (
                  <span className="text-muted">备注：{record.note}</span>
                )}
              </div>
              <div className="record-actions">
                <button
                  className={record.status === 'present' ? 'active-present' : 'inactive'}
                  onClick={() => handleCheck(record.id, 'present')}
                  disabled={!isEditable}
                >
                  已到
                </button>
                <button
                  className={record.status === 'absent' ? 'active-absent' : 'inactive'}
                  onClick={() => handleCheck(record.id, 'absent')}
                  disabled={!isEditable}
                >
                  未到
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {records.length === 0 && (
        <div className="empty-state">
          <div className="icon">&#128101;</div>
          <p>该楼层暂无学生</p>
        </div>
      )}
    </div>
  );
}
