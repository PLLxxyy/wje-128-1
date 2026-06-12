import db, { initDB } from './db.js';
import bcrypt from 'bcryptjs';

export function seed() {
  initDB();

  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (userCount.cnt > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database...');

  const hash = bcrypt.hashSync('123456', 10);

  // Insert test users
  const insertUser = db.prepare(
    'INSERT INTO users (username, password, name, role, building) VALUES (?, ?, ?, ?, ?)'
  );
  insertUser.run('test', hash, '张三', 'student', null);
  insertUser.run('test2', hash, '李四', 'student', null);
  insertUser.run('test3', hash, '王五', 'student', null);
  insertUser.run('test4', hash, '赵六', 'student', null);
  insertUser.run('test5', hash, '钱七', 'student', null);
  insertUser.run('test6', hash, '孙八', 'student', null);
  insertUser.run('admin', hash, '王宿管', 'dorm_admin', '1号楼');
  insertUser.run('counselor', hash, '李辅导员', 'counselor', '1号楼');

  // Insert buildings
  const insertBuilding = db.prepare('INSERT OR IGNORE INTO buildings (name) VALUES (?)');
  insertBuilding.run('1号楼');
  insertBuilding.run('2号楼');

  // Insert rooms: 1号楼 floors 1-3, 3 rooms per floor
  const insertRoom = db.prepare('INSERT OR IGNORE INTO rooms (building, floor, room_number) VALUES (?, ?, ?)');
  for (let floor = 1; floor <= 3; floor++) {
    for (let room = 1; room <= 4; room++) {
      insertRoom.run('1号楼', floor, `${floor}0${room}`);
    }
  }
  for (let floor = 1; floor <= 2; floor++) {
    for (let room = 1; room <= 3; room++) {
      insertRoom.run('2号楼', floor, `${floor}0${room}`);
    }
  }

  // Assign students to rooms in 1号楼
  const insertStudentRoom = db.prepare('INSERT INTO student_rooms (student_id, room_id) VALUES (?, ?)');
  // student id 1 (张三) -> room 1号楼 101
  insertStudentRoom.run(1, 1);
  // student id 2 (李四) -> room 1号楼 102
  insertStudentRoom.run(2, 2);
  // student id 3 (王五) -> room 1号楼 103
  insertStudentRoom.run(3, 3);
  // student id 4 (赵六) -> room 1号楼 201
  insertStudentRoom.run(4, 5);
  // student id 5 (钱七) -> room 1号楼 202
  insertStudentRoom.run(5, 6);
  // student id 6 (孙八) -> room 1号楼 301
  insertStudentRoom.run(6, 9);

  // Create a sample completed check task
  const insertTask = db.prepare(
    'INSERT INTO check_tasks (admin_id, building, floor, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(22, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 0, 0, 0);

  const today = new Date();
  today.setHours(22, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 0, 0, 0);

  insertTask.run(7, '1号楼', 1, yesterday.toISOString(), yesterdayEnd.toISOString(), 'completed');

  // Create a sample approved leave request for yesterday
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  db.prepare(
    'INSERT INTO leave_requests (student_id, leave_date, reason, status, reviewed_by, review_note, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(2, yesterdayStr, '回家参加家庭聚会', 'approved', 7, '同意', yesterdayEnd.toISOString());

  // Create a sample pending leave request for today
  const todayStr = today.toISOString().split('T')[0];
  db.prepare(
    'INSERT INTO leave_requests (student_id, leave_date, reason, status) VALUES (?, ?, ?, ?)'
  ).run(4, todayStr, '去医院看病', 'pending');

  // Create check records for the completed task
  const insertRecord = db.prepare(
    'INSERT INTO check_records (task_id, student_id, room_id, status, note, leave_reason, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insertRecord.run(1, 1, 1, 'present', '', '', yesterdayEnd.toISOString());
  insertRecord.run(1, 2, 2, 'leave', '请假', '回家参加家庭聚会', yesterdayEnd.toISOString());
  insertRecord.run(1, 3, 3, 'present', '', '', yesterdayEnd.toISOString());

  insertTask.run(7, '1号楼', 2, today.toISOString(), todayEnd.toISOString(), 'pending');

  // Create check records for today's task - check for approved leave first
  const leaveForToday = db.prepare(`
    SELECT * FROM leave_requests
    WHERE student_id = ? AND leave_date = ? AND status = 'approved'
  `);
  const student4Leave = leaveForToday.get(4, todayStr) as any;
  const student5Leave = leaveForToday.get(5, todayStr) as any;

  if (student4Leave) {
    insertRecord.run(2, 4, 5, 'leave', '请假', student4Leave.reason, null);
  } else {
    insertRecord.run(2, 4, 5, 'unchecked', '', '', null);
  }
  if (student5Leave) {
    insertRecord.run(2, 5, 6, 'leave', '请假', student5Leave.reason, null);
  } else {
    insertRecord.run(2, 5, 6, 'unchecked', '', '', null);
  }

  console.log('Database seeded successfully!');
}

// Run seed directly
seed();
