import { useState, useEffect } from 'react';
import { api } from '../api';

interface Props {
  user: { id: number; username: string; name: string; role: string; building?: string | null };
}

interface FloorRate {
  building: string;
  floor: number;
  total: number;
  present: number;
  absent: number;
  rate: string;
}

interface SummaryItem {
  task_id: number;
  building: string;
  floor: number;
  date: string;
  total: number;
  present: number;
  absent: number;
  unchecked: number;
  rate: string;
}

interface OverallStats {
  total_records: number;
  total_present: number;
  total_absent: number;
  rate: string;
}

interface AbsentItem {
  student_name: string;
  username: string;
  building: string;
  room_number: string;
  floor: number;
  note: string;
  task_date: string;
}

export default function CounselorHome({ user }: Props) {
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [overall, setOverall] = useState<OverallStats>({ total_records: 0, total_present: 0, total_absent: 0, rate: '0.0' });
  const [floorRates, setFloorRates] = useState<FloorRate[]>([]);
  const [absentList, setAbsentList] = useState<AbsentItem[]>([]);
  const [dateFilter, setDateFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState(user.building || '');
  const [buildings, setBuildings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAbsentList, setShowAbsentList] = useState(false);

  useEffect(() => {
    loadBuildings();
  }, []);

  useEffect(() => {
    loadData();
  }, [dateFilter, buildingFilter]);

  const loadBuildings = async () => {
    try {
      const data = await api.getBuildings();
      setBuildings(data.buildings);
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFilter) params.date = dateFilter;
      if (buildingFilter) params.building = buildingFilter;

      const [summaryData, floorData] = await Promise.all([
        api.getSummary(params),
        api.getFloorRate(params),
      ]);
      setSummary(summaryData.summary);
      setOverall(summaryData.overall);
      setFloorRates(floorData.floorRates);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAbsentList = async () => {
    try {
      const params: Record<string, string> = {};
      if (dateFilter) params.date = dateFilter;
      if (buildingFilter) params.building = buildingFilter;
      const data = await api.getAbsentList(params);
      setAbsentList(data.absentList);
      setShowAbsentList(true);
    } catch (err) {
      console.error(err);
    }
  };

  const exportCSV = () => {
    if (absentList.length === 0) {
      alert('暂无缺勤数据可导出');
      return;
    }
    const header = '姓名,学号,楼栋,寝室号,楼层,缺勤日期,备注\n';
    const rows = absentList.map(a =>
      `${a.student_name},${a.username},${a.building},${a.room_number},${a.floor}楼,${new Date(a.task_date).toLocaleDateString('zh-CN')},${a.note || ''}`
    ).join('\n');
    const csv = '﻿' + header + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `缺勤名单_${dateFilter || '全部'}_${buildingFilter || '全部楼栋'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      <h2 className="page-title">辅导员管理台</h2>

      {/* Filters */}
      <div className="filter-bar">
        <label style={{ fontSize: '14px', fontWeight: 500 }}>筛选：</label>
        <select value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)}>
          <option value="">全部楼栋</option>
          {buildings.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
        />
        {dateFilter && (
          <button className="btn btn-outline btn-sm" onClick={() => setDateFilter('')}>清除日期</button>
        )}
      </div>

      {/* Overall stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="stat-card stat-blue">
          <div className="num">{overall.total_records}</div>
          <div className="label">查寝总人次</div>
        </div>
        <div className="stat-card stat-green">
          <div className="num">{overall.total_present}</div>
          <div className="label">在寝人次</div>
        </div>
        <div className="stat-card stat-red">
          <div className="num">{overall.total_absent}</div>
          <div className="label">缺勤人次</div>
        </div>
        <div className="stat-card stat-orange">
          <div className="num">{overall.rate}%</div>
          <div className="label">总到寝率</div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">加载中...</div>
      ) : (
        <>
          {/* Floor rates */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '16px', fontWeight: 600, fontSize: '16px', borderBottom: '1px solid #f0f0f0' }}>
              各楼层到寝率
            </div>
            {floorRates.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px' }}>暂无数据</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>楼栋</th>
                    <th>楼层</th>
                    <th>应查人数</th>
                    <th>在寝</th>
                    <th>缺勤</th>
                    <th>到寝率</th>
                  </tr>
                </thead>
                <tbody>
                  {floorRates.map((f, i) => (
                    <tr key={i}>
                      <td>{f.building}</td>
                      <td>{f.floor}楼</td>
                      <td>{f.total}</td>
                      <td className="status-present">{f.present}</td>
                      <td className="status-absent">{f.absent > 0 ? <strong>{f.absent}</strong> : 0}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${f.rate}%`, height: '100%', background: parseFloat(f.rate) >= 90 ? '#52c41a' : parseFloat(f.rate) >= 70 ? '#fa8c16' : '#ff4d4f', borderRadius: '4px' }} />
                          </div>
                          <span style={{ minWidth: '48px', textAlign: 'right', fontWeight: 500 }}>{f.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Task summary */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '16px', fontWeight: 600, fontSize: '16px', borderBottom: '1px solid #f0f0f0' }}>
              查寝任务明细
            </div>
            {summary.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px' }}>暂无已完成的查寝任务</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>楼栋</th>
                    <th>楼层</th>
                    <th>日期</th>
                    <th>应查</th>
                    <th>在寝</th>
                    <th>缺勤</th>
                    <th>到寝率</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(s => (
                    <tr key={s.task_id}>
                      <td>{s.building}</td>
                      <td>{s.floor}楼</td>
                      <td>{new Date(s.date).toLocaleDateString('zh-CN')}</td>
                      <td>{s.total}</td>
                      <td className="status-present">{s.present}</td>
                      <td className="status-absent">{s.absent > 0 ? <strong>{s.absent}</strong> : 0}</td>
                      <td style={{ fontWeight: 500 }}>{s.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Export absent list */}
          <div className="card">
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>缺勤名单</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-outline btn-sm" onClick={loadAbsentList}>查看缺勤名单</button>
                <button className="btn btn-primary btn-sm" onClick={exportCSV}>导出 CSV</button>
              </div>
            </div>

            {showAbsentList && (
              absentList.length === 0 ? (
                <div className="success-msg">暂无缺勤记录</div>
              ) : (
                <div style={{ padding: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>姓名</th>
                        <th>学号</th>
                        <th>楼栋</th>
                        <th>寝室</th>
                        <th>缺勤日期</th>
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absentList.map((a, i) => (
                        <tr key={i}>
                          <td className="status-absent"><strong>{a.student_name}</strong></td>
                          <td>{a.username}</td>
                          <td>{a.building}</td>
                          <td>{a.room_number}</td>
                          <td>{new Date(a.task_date).toLocaleDateString('zh-CN')}</td>
                          <td>{a.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
