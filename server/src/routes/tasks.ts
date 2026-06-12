import { Router, Request, Response } from 'express';
import db from '../db.js';
import { authMiddleware, roleMiddleware, JwtPayload } from '../middleware/auth.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /api/tasks - Get tasks for current user
router.get('/', (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const { status, date } = req.query;

  let sql = '';
  let params: any[] = [];

  if (user.role === 'dorm_admin') {
    sql = 'SELECT * FROM check_tasks WHERE admin_id = ?';
    params = [user.id];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (date) {
      sql += ' AND date(start_time) = ?';
      params.push(date);
    }
    sql += ' ORDER BY created_at DESC';
  } else if (user.role === 'student') {
    // Students see tasks that have their records
    sql = `SELECT DISTINCT t.* FROM check_tasks t
           JOIN check_records r ON r.task_id = t.id
           JOIN student_rooms sr ON sr.room_id = r.room_id
           WHERE sr.student_id = ?`;
    params = [user.id];
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY t.created_at DESC';
  } else if (user.role === 'counselor') {
    sql = 'SELECT * FROM check_tasks WHERE 1=1';
    if (user.building) {
      sql += ' AND building = ?';
      params.push(user.building);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (date) {
      sql += ' AND date(start_time) = ?';
      params.push(date);
    }
    sql += ' ORDER BY created_at DESC';
  }

  const tasks = db.prepare(sql).all(...params);
  res.json({ tasks });
});

// POST /api/tasks - Create a check task (dorm_admin only)
router.post('/', roleMiddleware('dorm_admin'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const { building, floor, start_time, end_time } = req.body;

  if (!building || !floor || !start_time || !end_time) {
    res.status(400).json({ error: '请填写所有必填字段' });
    return;
  }

  // Get all students on this floor
  const students = db.prepare(`
    SELECT sr.student_id, sr.room_id
    FROM student_rooms sr
    JOIN rooms r ON r.id = sr.room_id
    WHERE r.building = ? AND r.floor = ?
  `).all(building, floor) as any[];

  if (students.length === 0) {
    res.status(400).json({ error: '该楼层没有学生' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO check_tasks (admin_id, building, floor, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(user.id, building, floor, start_time, end_time, 'pending');

  const taskId = Number(result.lastInsertRowid);

  // Create check records for each student
  const insertRecord = db.prepare(
    'INSERT INTO check_records (task_id, student_id, room_id, status) VALUES (?, ?, ?, ?)'
  );
  for (const s of students) {
    insertRecord.run(taskId, s.student_id, s.room_id, 'unchecked');
  }

  const task = db.prepare('SELECT * FROM check_tasks WHERE id = ?').get(taskId);
  res.status(201).json({ task });
});

// GET /api/tasks/:id - Get task detail with records
router.get('/:id', (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const taskId = Number(req.params.id);

  const task = db.prepare('SELECT * FROM check_tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    res.status(404).json({ error: '任务不存在' });
    return;
  }

  // Students can only see their own records
  if (user.role === 'student') {
    const record = db.prepare(`
      SELECT cr.*, u.name as student_name, r.room_number, r.building, r.floor
      FROM check_records cr
      JOIN users u ON u.id = cr.student_id
      JOIN rooms r ON r.id = cr.room_id
      WHERE cr.task_id = ? AND cr.student_id = ?
    `).get(taskId, user.id);
    res.json({ task, records: record ? [record] : [] });
    return;
  }

  const records = db.prepare(`
    SELECT cr.*, u.name as student_name, u.username, r.room_number, r.building, r.floor
    FROM check_records cr
    JOIN users u ON u.id = cr.student_id
    JOIN rooms r ON r.id = cr.room_id
    WHERE cr.task_id = ?
    ORDER BY r.room_number, u.name
  `).all(taskId);

  res.json({ task, records });
});

// PUT /api/tasks/:id/records/:recordId - Update a check record (dorm_admin)
router.put('/:id/records/:recordId', roleMiddleware('dorm_admin'), (req: Request, res: Response) => {
  const recordId = Number(req.params.recordId);
  const { status, note } = req.body;

  if (!['present', 'absent'].includes(status)) {
    res.status(400).json({ error: '无效的状态' });
    return;
  }

  db.prepare(
    'UPDATE check_records SET status = ?, note = ?, checked_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, note || '', recordId);

  const record = db.prepare('SELECT * FROM check_records WHERE id = ?').get(recordId);
  res.json({ record });
});

// POST /api/tasks/:id/submit - Submit entire task (dorm_admin)
router.post('/:id/submit', roleMiddleware('dorm_admin'), (req: Request, res: Response) => {
  const taskId = Number(req.params.id);
  const task = db.prepare('SELECT * FROM check_tasks WHERE id = ?').get(taskId) as any;

  if (!task) {
    res.status(404).json({ error: '任务不存在' });
    return;
  }

  // Mark any unchecked records as absent
  db.prepare(
    `UPDATE check_records SET status = 'absent', note = '未点名自动标记', checked_at = CURRENT_TIMESTAMP
     WHERE task_id = ? AND status = 'unchecked'`
  ).run(taskId);

  db.prepare(
    "UPDATE check_tasks SET status = 'completed' WHERE id = ?"
  ).run(taskId);

  res.json({ message: '提交成功' });
});

// POST /api/tasks/:id/start - Start task (dorm_admin)
router.post('/:id/start', roleMiddleware('dorm_admin'), (req: Request, res: Response) => {
  const taskId = Number(req.params.id);
  db.prepare("UPDATE check_tasks SET status = 'in_progress' WHERE id = ?").run(taskId);
  res.json({ message: '任务已开始' });
});

export default router;
