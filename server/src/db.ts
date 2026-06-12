import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'dorm.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function columnExists(tableName: string, columnName: string): boolean {
  const cols = db.pragma(`table_info(${tableName})`) as { name: string }[];
  return cols.some(c => c.name === columnName);
}

function tableExists(tableName: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
  return !!row;
}

function migrateLeaveFeature() {
  const hasLeaveRequests = tableExists('leave_requests');
  const hasCheckRecords = tableExists('check_records');
  const hasLeaveReasonColumn = hasCheckRecords && columnExists('check_records', 'leave_reason');

  if (!hasLeaveRequests) {
    console.log('[Migration] Creating leave_requests table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        leave_date DATE NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        reviewed_by INTEGER,
        review_note TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,
        FOREIGN KEY(student_id) REFERENCES users(id),
        FOREIGN KEY(reviewed_by) REFERENCES users(id)
      );
    `);
  }

  if (hasCheckRecords) {
    const needRebuild = !hasLeaveReasonColumn;

    if (!hasLeaveReasonColumn) {
      console.log('[Migration] Rebuilding check_records table to add leave_reason and support leave status...');
      db.pragma('foreign_keys = OFF');
      const transaction = db.transaction(() => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS check_records_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            room_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'unchecked',
            note TEXT DEFAULT '',
            leave_reason TEXT DEFAULT '',
            checked_at DATETIME,
            FOREIGN KEY(task_id) REFERENCES check_tasks(id),
            FOREIGN KEY(student_id) REFERENCES users(id),
            FOREIGN KEY(room_id) REFERENCES rooms(id)
          );
        `);

        const oldCols = (db.pragma('table_info(check_records)') as { name: string }[]).map(c => c.name);
        const selectCols: string[] = [];
        const insertCols: string[] = [];
        for (const col of ['id', 'task_id', 'student_id', 'room_id', 'status', 'note', 'checked_at']) {
          if (oldCols.includes(col)) {
            selectCols.push(col);
            insertCols.push(col);
          }
        }

        const hasNote = oldCols.includes('note');
        const rows = db.prepare(`SELECT ${selectCols.join(', ')} FROM check_records`).all() as any[];

        const insert = db.prepare(`
          INSERT INTO check_records_new (${insertCols.join(', ')}, leave_reason)
          VALUES (${insertCols.map(() => '?').join(', ')}, ?)
        `);

        for (const row of rows) {
          let newStatus = row.status;
          let leaveReason = '';
          if (hasNote && row.note && typeof row.note === 'string') {
            const note = row.note as string;
            if (row.status === 'absent' && /请假|休假|回家|病假/.test(note)) {
              newStatus = 'leave';
              leaveReason = note;
            }
          }
          const values: any[] = insertCols.map(c => {
            if (c === 'status') return newStatus;
            return row[c];
          });
          values.push(leaveReason);
          insert.run(...values);
        }

        db.exec(`DROP TABLE check_records`);
        db.exec(`ALTER TABLE check_records_new RENAME TO check_records`);
      });
      transaction();
      db.pragma('foreign_keys = ON');
      console.log('[Migration] check_records table rebuilt successfully.');
    }

    const absentWithLeaveNote = db.prepare(`
      SELECT COUNT(*) as cnt FROM check_records
      WHERE status = 'absent' AND note IS NOT NULL AND note != ''
        AND (note LIKE '%请假%' OR note LIKE '%休假%' OR note LIKE '%回家%' OR note LIKE '%病假%')
    `).get() as { cnt: number };

    if (absentWithLeaveNote.cnt > 0) {
      console.log(`[Migration] Migrating ${absentWithLeaveNote.cnt} historical 'absent' records with leave note to 'leave' status...`);
      db.prepare(`
        UPDATE check_records
        SET status = 'leave', leave_reason = note
        WHERE status = 'absent' AND note IS NOT NULL AND note != ''
          AND (note LIKE '%请假%' OR note LIKE '%休假%' OR note LIKE '%回家%' OR note LIKE '%病假%')
      `).run();
    }
  }
}

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','dorm_admin','counselor')),
      building TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building TEXT NOT NULL,
      floor INTEGER NOT NULL,
      room_number TEXT NOT NULL,
      UNIQUE(building, floor, room_number)
    );

    CREATE TABLE IF NOT EXISTS student_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      FOREIGN KEY(student_id) REFERENCES users(id),
      FOREIGN KEY(room_id) REFERENCES rooms(id),
      UNIQUE(student_id)
    );

    CREATE TABLE IF NOT EXISTS check_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      building TEXT NOT NULL,
      floor INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(admin_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS check_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unchecked',
      note TEXT DEFAULT '',
      leave_reason TEXT DEFAULT '',
      checked_at DATETIME,
      FOREIGN KEY(task_id) REFERENCES check_tasks(id),
      FOREIGN KEY(student_id) REFERENCES users(id),
      FOREIGN KEY(room_id) REFERENCES rooms(id)
    );
  `);

  migrateLeaveFeature();
}

export default db;
