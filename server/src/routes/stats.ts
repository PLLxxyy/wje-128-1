import { Router, Request, Response } from 'express';
import db from '../db.js';
import { authMiddleware, roleMiddleware, JwtPayload } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/stats/summary - Counselor: get summary stats
router.get('/summary', roleMiddleware('counselor'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const { date, building } = req.query;

  const targetBuilding = building || user.building;

  // Get tasks for this building
  let taskSql = 'SELECT * FROM check_tasks WHERE status = ?';
  let taskParams: any[] = ['completed'];
  if (targetBuilding) {
    taskSql += ' AND building = ?';
    taskParams.push(targetBuilding);
  }
  if (date) {
    taskSql += ' AND date(start_time) = ?';
    taskParams.push(date);
  }
  taskSql += ' ORDER BY start_time DESC';

  const tasks = db.prepare(taskSql).all(...taskParams) as any[];

  // For each task, get attendance stats
  const summary = tasks.map((task: any) => {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_count,
        SUM(CASE WHEN status = 'unchecked' THEN 1 ELSE 0 END) as unchecked_count
      FROM check_records WHERE task_id = ?
    `).get(task.id) as any;

    return {
      task_id: task.id,
      building: task.building,
      floor: task.floor,
      date: task.start_time,
      total: stats.total,
      present: stats.present_count,
      absent: stats.absent_count,
      leave: stats.leave_count,
      unchecked: stats.unchecked_count,
      rate: stats.total > 0 ? ((stats.present_count / stats.total) * 100).toFixed(1) : '0.0',
    };
  });

  // Overall stats
  let overallSql = `
    SELECT
      COUNT(*) as total_records,
      SUM(CASE WHEN cr.status = 'present' THEN 1 ELSE 0 END) as total_present,
      SUM(CASE WHEN cr.status = 'absent' THEN 1 ELSE 0 END) as total_absent,
      SUM(CASE WHEN cr.status = 'leave' THEN 1 ELSE 0 END) as total_leave
    FROM check_records cr
    JOIN check_tasks t ON t.id = cr.task_id
    WHERE t.status = 'completed'
  `;
  let overallParams: any[] = [];
  if (targetBuilding) {
    overallSql += ' AND t.building = ?';
    overallParams.push(targetBuilding);
  }
  if (date) {
    overallSql += ' AND date(t.start_time) = ?';
    overallParams.push(date);
  }

  const overall = db.prepare(overallSql).get(...overallParams) as any;

  res.json({
    summary,
    overall: {
      total_records: overall.total_records || 0,
      total_present: overall.total_present || 0,
      total_absent: overall.total_absent || 0,
      total_leave: overall.total_leave || 0,
      rate: overall.total_records > 0
        ? ((overall.total_present / overall.total_records) * 100).toFixed(1)
        : '0.0',
    },
  });
});

// GET /api/stats/absent-list - Counselor: get absent list for export
router.get('/absent-list', roleMiddleware('counselor'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const { date, building } = req.query;

  const targetBuilding = building || user.building;

  let sql = `
    SELECT u.name as student_name, u.username, r.building, r.room_number, r.floor,
           cr.note, t.start_time as task_date
    FROM check_records cr
    JOIN users u ON u.id = cr.student_id
    JOIN rooms r ON r.id = cr.room_id
    JOIN check_tasks t ON t.id = cr.task_id
    WHERE cr.status = 'absent' AND t.status = 'completed'
  `;
  let params: any[] = [];
  if (targetBuilding) {
    sql += ' AND t.building = ?';
    params.push(targetBuilding);
  }
  if (date) {
    sql += ' AND date(t.start_time) = ?';
    params.push(date);
  }
  sql += ' ORDER BY t.start_time DESC, r.room_number, u.name';

  const absentList = db.prepare(sql).all(...params);
  res.json({ absentList });
});

// GET /api/stats/leave-list - Counselor: get leave list for export
router.get('/leave-list', roleMiddleware('counselor'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const { date, building } = req.query;

  const targetBuilding = building || user.building;

  let sql = `
    SELECT u.name as student_name, u.username, r.building, r.room_number, r.floor,
           cr.leave_reason, cr.note, t.start_time as task_date
    FROM check_records cr
    JOIN users u ON u.id = cr.student_id
    JOIN rooms r ON r.id = cr.room_id
    JOIN check_tasks t ON t.id = cr.task_id
    WHERE cr.status = 'leave' AND t.status = 'completed'
  `;
  let params: any[] = [];
  if (targetBuilding) {
    sql += ' AND t.building = ?';
    params.push(targetBuilding);
  }
  if (date) {
    sql += ' AND date(t.start_time) = ?';
    params.push(date);
  }
  sql += ' ORDER BY t.start_time DESC, r.room_number, u.name';

  const leaveList = db.prepare(sql).all(...params);
  res.json({ leaveList });
});

// GET /api/stats/floor-rate - Counselor: attendance rate by floor
router.get('/floor-rate', roleMiddleware('counselor'), (req: Request, res: Response) => {
  const user = (req as any).user as JwtPayload;
  const { date, building } = req.query;

  const targetBuilding = building || user.building;

  let sql = `
    SELECT t.floor, t.building,
      COUNT(*) as total,
      SUM(CASE WHEN cr.status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN cr.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN cr.status = 'leave' THEN 1 ELSE 0 END) as leave_count
    FROM check_records cr
    JOIN check_tasks t ON t.id = cr.task_id
    WHERE t.status = 'completed'
  `;
  let params: any[] = [];
  if (targetBuilding) {
    sql += ' AND t.building = ?';
    params.push(targetBuilding);
  }
  if (date) {
    sql += ' AND date(t.start_time) = ?';
    params.push(date);
  }
  sql += ' GROUP BY t.building, t.floor ORDER BY t.building, t.floor';

  const floorRates = db.prepare(sql).all(...params) as any[];

  const result = floorRates.map((f: any) => ({
    building: f.building,
    floor: f.floor,
    total: f.total,
    present: f.present_count,
    absent: f.absent_count,
    leave: f.leave_count || 0,
    rate: f.total > 0 ? ((f.present_count / f.total) * 100).toFixed(1) : '0.0',
  }));

  res.json({ floorRates: result });
});

export default router;
