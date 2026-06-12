import { useState, useEffect } from 'react';
import { api } from '../api';

interface Props {
  user: { id: number; username: string; name: string; role: string };
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

const statusClass: Record<string, string> = {
  pending: 'status-unchecked',
  approved: 'status-present',
  rejected: 'status-absent',
};

export default function StudentLeavePage({ user }: Props) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaveDate, setLeaveDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate || !reason.trim()) {
      alert('请填写请假日期和理由');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitLeave({ leave_date: leaveDate, reason: reason.trim() });
      setLeaveDate('');
      setReason('');
      loadLeaves();
      alert('请假申请提交成功');
    } catch (err: any) {
      alert(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const approvedCount = leaves.filter(l => l.status === 'approved').length;
  const pendingCount = leaves.filter(l => l.status === 'pending').length;

  return (
    <div className="page-container">
      <h2 className="page-title">请假申请</h2>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="card-title" style={{ marginBottom: '16px' }}>提交请假申请</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>请假日期</label>
            <input
              type="date"
              value={leaveDate}
              min={today}
              onChange={e => setLeaveDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d9d9d9', borderRadius: '6px', fontSize: '14px' }}
              required
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>请假理由</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="请详细说明请假理由..."
              rows={4}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d9d9d9', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: '100%' }}
          >
            {submitting ? '提交中...' : '提交请假申请'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="stat-card stat-blue">
          <div className="num">{leaves.length}</div>
          <div className="label">请假总次数</div>
        </div>
        <div className="stat-card stat-green">
          <div className="num">{approvedCount}</div>
          <div className="label">已批准</div>
        </div>
        <div className="stat-card stat-orange">
          <div className="num">{pendingCount}</div>
          <div className="label">待审批</div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between" style={{ marginBottom: '12px' }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}>请假记录</h3>
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
            <p>暂无请假记录</p>
          </div>
        ) : (
          <div style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>请假日期</th>
                  <th>请假理由</th>
                  <th>状态</th>
                  <th>审批意见</th>
                  <th>提交时间</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map(leave => (
                  <tr key={leave.id}>
                    <td>{new Date(leave.leave_date).toLocaleDateString('zh-CN')}</td>
                    <td style={{ maxWidth: '300px' }}>{leave.reason}</td>
                    <td className={statusClass[leave.status]}>
                      <strong>{statusText[leave.status]}</strong>
                    </td>
                    <td>{leave.review_note || '-'}</td>
                    <td>{new Date(leave.created_at).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
