import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import { listProjects, type ProjectOverview } from '../../api/client';
import './dashboard-home.css';

function formatRelative(iso: string): string {
  const then = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const ms = Date.now() - then;
  const min = Math.round(ms / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(then).toISOString().slice(0, 10);
}

function DashboardHome() {
  const [projects, setProjects] = useState<ProjectOverview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, []);

  return (
    <DashboardLayout>
      <div className="dh-header-row">
        <h1 className="dh-title">研究项目</h1>
        <Link to="/dashboard/create" className="dh-create-btn">新建项目</Link>
      </div>
      {error && <p className="dh-error" role="alert">{error}</p>}
      {projects === null && !error && <p className="dh-loading">加载中…</p>}
      {projects && projects.length === 0 && (
        <SurfaceCard className="dh-empty">
          <p>还没有项目。先在受访者端创建访谈链接吧。</p>
        </SurfaceCard>
      )}
      {projects && projects.length > 0 && (
        <div className="dh-grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/dashboard/projects/${p.id}`} className="dh-card-link">
              <SurfaceCard className="dh-card">
                <h2 className="dh-card-name">{p.name}</h2>
                <p className="dh-card-time">{formatRelative(p.created_at)}</p>
                <div className="dh-card-stats">
                  <div className="dh-stat">
                    <div className="dh-stat-num">{p.total}</div>
                    <div className="dh-stat-label">参与</div>
                  </div>
                  <div className="dh-stat">
                    <div className="dh-stat-num">{p.completed}</div>
                    <div className="dh-stat-label">完成</div>
                  </div>
                  <div className="dh-stat">
                    <div className="dh-stat-num">
                      {p.avg_duration_min === null ? '—' : `${p.avg_duration_min.toFixed(1)}m`}
                    </div>
                    <div className="dh-stat-label">平均时长</div>
                  </div>
                </div>
              </SurfaceCard>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export default DashboardHome;
