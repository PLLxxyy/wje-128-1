import { Router, Request, Response } from 'express';
import db from '../db.js';
import { authMiddleware, roleMiddleware, JwtPayload } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/leaves - Get leave requests (student: own, dorm_admin: pending for building, counselor: all)
router.get('/', (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const { status, date, student_id } = req.query;

  let sql = `
    SELECT lr.*, u.name as student_name, u.username, r.room_number, r.building, r.floor
    FROM leave_requests lr
    JOIN users u ON u.id = lr.student_id
    LEFT JOIN student_rooms sr ON sr.student_id = lr.student_id
    LEFT JOIN rooms r ON r.id = sr.room_id
    WHERE 1=1
  `;
  let params: any[] = [];

  if (user.role === 'student') {
    sql += ' AND lr.student_id = ?';
    params.push(user.id);
  } else if (user.role === 'dorm_admin') {
    sql += ' AND r.building = ?';
    params.push(user.building);
  } else if (user.role === 'counselor' && user.building) {
    sql += ' AND r.building = ?';
    params.push(user.building);
  }

  if (student_id && user.role !== 'student') {
    sql += ' AND lr.student_id = ?';
    params.push(student_id);
  }

  if (status) {
    sql += ' AND lr.status = ?';
    params.push(status);
  }

  if (date) {
    sql += ' AND lr.leave_date = ?';
    params.push(date);
  }

  sql += ' ORDER BY lr.created_at DESC';

  const leaves = db.prepare(sql).all(...params);
  res.json({ leaves });
});

// POST /api/leaves - Submit leave request (student only)
router.post('/', roleMiddleware('student'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const { leave_date, reason } = req.body;

  if (!leave_date || !reason) {
    res.status(400).json({ error: '请填写请假日期和理由' });
    return;
  }

  const leaveDate = new Date(leave_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (leaveDate < today) {
    res.status(400).json({ error: '请假日期不能早于今天' });
    return;
  }

  const dateStr = leaveDate.toISOString().split('T')[0];

  const existing = db.prepare(`
    SELECT * FROM leave_requests
    WHERE student_id = ? AND leave_date = ? AND status != 'rejected'
  `).get(user.id, dateStr);

  if (existing) {
    res.status(400).json({ error: '该日期已有请假申请' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO leave_requests (student_id, leave_date, reason, status)
    VALUES (?, ?, ?, 'pending')
  `).run(user.id, dateStr, reason);

  const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ leave });
});

// PUT /api/leaves/:id/approve - Approve leave request (dorm_admin only)
router.put('/:id/approve', roleMiddleware('dorm_admin'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const leaveId = Number(req.params.id);
  const { review_note } = req.body;

  const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leaveId) as any;
  if (!leave) {
    res.status(404).json({ error: '请假申请不存在' });
    return;
  }

  if (leave.status !== 'pending') {
    res.status(400).json({ error: '该申请已处理' });
    return;
  }

  const studentRoom = db.prepare(`
    SELECT r.building FROM student_rooms sr
    JOIN rooms r ON r.id = sr.room_id
    WHERE sr.student_id = ?
  `).get(leave.student_id) as any;

  if (studentRoom && studentRoom.building !== user.building) {
    res.status(403).json({ error: '无权审批该请假申请' });
    return;
  }

  db.prepare(`
    UPDATE leave_requests
    SET status = 'approved', reviewed_by = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id, review_note || '', leaveId);

  const tasks = db.prepare(`
    SELECT t.id FROM check_tasks t
    JOIN check_records cr ON cr.task_id = t.id
    WHERE cr.student_id = ? AND date(t.start_time) = ?
  `).all(leave.student_id, leave.leave_date) as any[];

  if (tasks.length > 0) {
    const updateRecord = db.prepare(`
      UPDATE check_records
      SET status = 'leave', leave_reason = ?, note = '请假', checked_at = CURRENT_TIMESTAMP
      WHERE task_id = ? AND student_id = ?
    `);
    for (const task of tasks) {
      updateRecord.run(leave.reason, task.id, leave.student_id);
    }
  }

  const updatedLeave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leaveId);
  res.json({ leave: updatedLeave });
});

// PUT /api/leaves/:id/reject - Reject leave request (dorm_admin only)
router.put('/:id/reject', roleMiddleware('dorm_admin'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const leaveId = Number(req.params.id);
  const { review_note } = req.body;

  const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leaveId) as any;
  if (!leave) {
    res.status(404).json({ error: '请假申请不存在' });
    return;
  }

  if (leave.status !== 'pending') {
    res.status(400).json({ error: '该申请已处理' });
    return;
  }

  const studentRoom = db.prepare(`
    SELECT r.building FROM student_rooms sr
    JOIN rooms r ON r.id = sr.room_id
    WHERE sr.student_id = ?
  `).get(leave.student_id) as any;

  if (studentRoom && studentRoom.building !== user.building) {
    res.status(403).json({ error: '无权审批该请假申请' });
    return;
  }

  db.prepare(`
    UPDATE leave_requests
    SET status = 'rejected', reviewed_by = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id, review_note || '', leaveId);

  const updatedLeave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leaveId);
  res.json({ leave: updatedLeave });
});

// GET /api/leaves/pending-count - Get pending leave count for dorm admin
router.get('/pending/count', roleMiddleware('dorm_admin'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;

  const count = db.prepare(`
    SELECT COUNT(*) as cnt FROM leave_requests lr
    JOIN student_rooms sr ON sr.student_id = lr.student_id
    JOIN rooms r ON r.id = sr.room_id
    WHERE lr.status = 'pending' AND r.building = ?
  `).get(user.building) as any;

  res.json({ count: count.cnt });
});

export default router;
