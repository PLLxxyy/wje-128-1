import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Props {
  user: { id: number; username: string; name: string; role: string; building?: string | null };
}

interface LeaveRequest {
  id: number;
  student_id: number;
  leave_date: string;
  reason: string;
  status: string;
  review_note: string;
  created_at: string;
  reviewed_at: string | null;
  student_name: string;
  username: string;
  room_number: string;
  building: string;
  floor: number;
}

const statusText: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
};

const statusBadge: Record<string, string> = {
  pending: 'badge-pending',
  approved: 'badge-completed',
  rejected: 'badge-in_progress',
};

export default function AdminLeaveApproval({ user }: Props) {
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadLeaves();
  }, [statusFilter]);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const data = await api.getLeaveList(params);
      setLeaves(data.leaves);
      const notes: Record<number, string> = {};
      for (const l of data.leaves) {
        notes[l.id] = '';
      }
      setReviewNotes(notes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (leaveId: number) => {
    if (!confirm('确定批准该请假申请吗？')) return;
    setProcessingId(leaveId);
    try {
      await api.approveLeave(leaveId, reviewNotes[leaveId] || '');
      loadLeaves();
      alert('已批准');
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (leaveId: number) => {
    if (!confirm('确定拒绝该请假申请吗？')) return;
    setProcessingId(leaveId);
    try {
      await api.rejectLeave(leaveId, reviewNotes[leaveId] || '');
      loadLeaves();
      alert('已拒绝');
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const approvedCount = leaves.filter(l => l.status === 'approved').length;
  const rejectedCount = leaves.filter(l => l.status === 'rejected').length;

  return (
    <div className="page-container">
      <div className="flex-between" style={{ marginBottom: '20px' }}>
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/')} style={{ marginBottom: '8px' }}>
            &larr; 返回
          </button>
          <h2 className="page-title" style={{ marginBottom: 0 }}>请假审批</h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="stat-card stat-orange">
          <div className="num">{pendingCount}</div>
          <div className="label">待审批</div>
        </div>
        <div className="stat-card stat-green">
          <div className="num">{approvedCount}</div>
          <div className="label">已批准</div>
        </div>
        <div className="stat-card stat-red">
          <div className="num">{rejectedCount}</div>
          <div className="label">已拒绝</div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between" style={{ marginBottom: '12px' }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}>请假申请列表</h3>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: '6px', fontSize: '13px' }}
          >
            <option value="">全部状态</option>
            <option value="pending">待审批</option>
            <option value="approved">已批准</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : leaves.length === 0 ? (
          <div className="empty-state">
            <div className="icon">&#128197;</div>
            <p>暂无请假申请</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {leaves.map(leave => (
              <div key={leave.id} className="card" style={{ padding: '16px', margin: 0 }}>
                <div className="flex-between" style={{ marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>{leave.student_name}</span>
                    <span className="text-muted" style={{ marginLeft: '8px' }}>({leave.username})</span>
                    <span style={{ marginLeft: '12px', fontSize: '14px' }}>
                      {leave.building} {leave.floor}楼 {leave.room_number}寝室
                    </span>
                  </div>
                  <span className={`badge ${statusBadge[leave.status]}`}>
                    {statusText[leave.status]}
                  </span>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                    <strong>请假日期：</strong>{new Date(leave.leave_date).toLocaleDateString('zh-CN')}
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    <strong>请假理由：</strong>{leave.reason}
                  </div>
                </div>

                {leave.status === 'pending' ? (
                  <div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666' }}>审批意见（可选）</label>
                      <input
                        type="text"
                        placeholder="请输入审批意见..."
                        value={reviewNotes[leave.id] || ''}
                        onChange={e => setReviewNotes(prev => ({ ...prev, [leave.id]: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleApprove(leave.id)}
                        disabled={processingId === leave.id}
                      >
                        {processingId === leave.id ? '处理中...' : '批准'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleReject(leave.id)}
                        disabled={processingId === leave.id}
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    <strong>审批意见：</strong>{leave.review_note || '无'}
                    <span style={{ marginLeft: '16px' }}>
                      <strong>审批时间：</strong>{leave.reviewed_at ? new Date(leave.reviewed_at).toLocaleString('zh-CN') : '-'}
                    </span>
                  </div>
                )}

                <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                  提交时间：{new Date(leave.created_at).toLocaleString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
