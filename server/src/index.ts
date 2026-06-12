import express from 'express';
import cors from 'cors';
import { initDB } from './db.js';
import { seed } from './seed.js';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import recordRoutes from './routes/records.js';
import statsRoutes from './routes/stats.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Init DB and seed
initDB();
seed();

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (authMiddleware applied per router)
app.use('/api/tasks', taskRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
