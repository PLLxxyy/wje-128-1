import { Router, Request, Response } from 'express';
import db from '../db.js';
import { authMiddleware, roleMiddleware, JwtPayload } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/records/student - Get current student's check records
router.get('/student', roleMiddleware('student'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;

  const records = db.prepare(`
    SELECT cr.*, t.building, t.floor, t.start_time, t.end_time, t.status as task_status,
           r.room_number
    FROM check_records cr
    JOIN check_tasks t ON t.id = cr.task_id
    JOIN rooms r ON r.id = cr.room_id
    WHERE cr.student_id = ?
    ORDER BY t.start_time DESC
  `).all(user.id);

  res.json({ records });
});

// GET /api/records/task/:taskId - Get all records for a task
router.get('/task/:taskId', (req: Request, res: Response) => {
  const taskId = Number(req.params.taskId);
  const user = (req as any).user as JwtPayload;

  if (user.role === 'student') {
    const records = db.prepare(`
      SELECT cr.*, u.name as student_name, r.room_number
      FROM check_records cr
      JOIN users u ON u.id = cr.student_id
      JOIN rooms r ON r.id = cr.room_id
      WHERE cr.task_id = ? AND cr.student_id = ?
    `).all(taskId, user.id);
    res.json({ records });
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

  res.json({ records });
});

export default router;
