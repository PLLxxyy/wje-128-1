import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    building: user.building,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      building: user.building,
    },
  });
});

// POST /api/auth/register
router.post('/register', (req: Request, res: Response) => {
  const { username, password, name, role, building } = req.body;
  if (!username || !password || !name || !role) {
    res.status(400).json({ error: '请填写所有必填字段' });
    return;
  }

  if (!['student', 'dorm_admin', 'counselor'].includes(role)) {
    res.status(400).json({ error: '无效的角色' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(400).json({ error: '用户名已存在' });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password, name, role, building) VALUES (?, ?, ?, ?, ?)'
  ).run(username, hash, name, role, building || null);

  const token = generateToken({
    id: Number(result.lastInsertRowid),
    username,
    role,
    name,
    building: building || null,
  });

  res.status(201).json({
    token,
    user: {
      id: Number(result.lastInsertRowid),
      username,
      name,
      role,
      building: building || null,
    },
  });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const dbUser = db.prepare('SELECT id, username, name, role, building FROM users WHERE id = ?').get(user.id) as any;
  if (!dbUser) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({ user: dbUser });
});

// GET /api/auth/buildings
router.get('/buildings', (_req: Request, res: Response) => {
  const buildings = db.prepare('SELECT name FROM buildings ORDER BY name').all();
  res.json({ buildings: buildings.map((b: any) => b.name) });
});

export default router;
