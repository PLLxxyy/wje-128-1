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
  leave_reason: string;
  checked_at: string | null;
}

interface LeaveRequest {
  id: number;
  student_id: number;
  student_name: string;
  username: string;
  room_number: string;
  leave_date: string;
  reason: string;
  status: string;
}

export default function AdminTaskDetail({ user }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [records, setRecords] = useState<CheckRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [processingLeaveId, setProcessingLeaveId] = useState<number | null>(null);
  const [leaveReviewNotes, setLeaveReviewNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      const data = await api.getTaskDetail(Number(id));
      setTask(data.task);
      setRecords(data.records);
      setLeaveRequests(data.leave_requests || []);
      // Init note map
      const notes: Record<number, string> = {};
      for (const r of data.records) {
        notes[r.id] = r.note || '';
      }
      setEditingNote(notes);
      // Init leave review notes
      const leaveNotes: Record<number, string> = {};
      for (const l of data.leave_requests || []) {
        leaveNotes[l.id] = '';
      }
      setLeaveReviewNotes(leaveNotes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async (recordId: number, status: 'present' | 'absent' | 'leave') => {
    const note = editingNote[recordId] || '';
    const record = records.find(r => r.id === recordId);
    const leave = leaveRequests.find(l => l.student_id === record?.student_id && l.status === 'approved');
    const leaveReason = status === 'leave' ? (leave?.reason || note) : '';
    try {
      await api.updateRecord(Number(id), recordId, status, note, leaveReason);
      setRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, status, note, leave_reason: leaveReason } : r)
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

  const handleApproveLeave = async (leaveId: number) => {
    if (!confirm('确定批准该请假申请吗？')) return;
    setProcessingLeaveId(leaveId);
    try {
      await api.approveLeave(leaveId, leaveReviewNotes[leaveId] || '');
      loadTask();
      alert('已批准');
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleRejectLeave = async (leaveId: number) => {
    if (!confirm('确定拒绝该请假申请吗？')) return;
    setProcessingLeaveId(leaveId);
    try {
      await api.rejectLeave(leaveId, leaveReviewNotes[leaveId] || '');
      loadTask();
      alert('已拒绝');
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setProcessingLeaveId(null);
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
  const leaveCount = records.filter(r => r.status === 'leave').length;
  const approvedLeaves = leaveRequests.filter(l => l.status === 'approved');
  const pendingLeaves = leaveRequests.filter(l => l.status === 'pending');

  const isEditable = task.status !== 'completed';

  const getStudentLeave = (studentId: number) => {
    return leaveRequests.find(l => l.student_id === studentId && l.status === 'approved');
  };

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
          <div className="stat-card stat-orange" style={{ padding: '12px 20px', minWidth: '100px' }}>
            <div className="num" style={{ fontSize: '22px' }}>{leaveCount}</div>
            <div className="label">请假</div>
          </div>
        </div>
      </div>

      {/* Pending leave requests */}
      {pendingLeaves.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', border: '2px solid #faad14', background: '#fffbe6' }}>
          <h3 className="card-title" style={{ marginBottom: '12px', color: '#d48806' }}>
            &#9888; 待审批请假申请 ({pendingLeaves.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingLeaves.map(leave => (
              <div key={leave.id} className="card" style={{ padding: '12px', margin: 0, background: 'white' }}>
                <div className="flex-between" style={{ marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{leave.student_name}</span>
                    <span className="text-muted" style={{ marginLeft: '8px' }}>({leave.username})</span>
                    <span style={{ marginLeft: '12px', fontSize: '13px' }}>
                      {leave.room_number}寝室
                    </span>
                  </div>
                  <span className="badge badge-pending">待审批</span>
                </div>
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>请假日期：</strong>{new Date(leave.leave_date).toLocaleDateString('zh-CN')}
                </div>
                <div style={{ fontSize: '13px', marginBottom: '10px' }}>
                  <strong>请假理由：</strong>{leave.reason}
                </div>
                {isEditable && (
                  <div>
                    <div style={{ marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder="审批意见（可选）"
                        value={leaveReviewNotes[leave.id] || ''}
                        onChange={e => setLeaveReviewNotes(prev => ({ ...prev, [leave.id]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleApproveLeave(leave.id)}
                        disabled={processingLeaveId === leave.id}
                      >
                        {processingLeaveId === leave.id ? '处理中...' : '批准'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRejectLeave(leave.id)}
                        disabled={processingLeaveId === leave.id}
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
          {roomRecords.map(record => {
            const studentLeave = getStudentLeave(record.student_id);
            return (
              <div key={record.id} className="record-row" style={studentLeave ? { background: '#fffbe6' } : undefined}>
                <span className="student-name">{record.student_name}</span>
                <span className="room-info">({record.username})</span>
                <div style={{ flex: 1 }}>
                  {studentLeave && (
                    <div style={{ fontSize: '12px', color: '#d48806', marginBottom: '4px' }}>
                      <strong>已批准请假：</strong>{studentLeave.reason}
                    </div>
                  )}
                  {record.status === 'leave' && record.leave_reason && !studentLeave && (
                    <div style={{ fontSize: '12px', color: '#d48806', marginBottom: '4px' }}>
                      <strong>请假理由：</strong>{record.leave_reason}
                    </div>
                  )}
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
                  <button
                    className={record.status === 'leave' ? 'active-leave' : 'inactive'}
                    onClick={() => handleCheck(record.id, 'leave')}
                    disabled={!isEditable}
                    style={studentLeave ? { borderColor: '#faad14', color: '#faad14' } : undefined}
                  >
                    请假
                  </button>
                </div>
              </div>
            );
          })}
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
