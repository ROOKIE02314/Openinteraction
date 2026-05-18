import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import { listProjects, type ProjectOverview } from '../../api/client';
import './projects-list.css';

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

function ProjectsList() {
  const [projects, setProjects] = useState<ProjectOverview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, []);

  return (
    <DashboardLayout title="研究项目" subtitle="按项目浏览所有访谈活动">
      <div className="pl-header-row">
        <span />
        <Link to="/dashboard/create" className="pl-create-btn">新建项目</Link>
      </div>
      {error && <p className="pl-error" role="alert">{error}</p>}
      {projects === null && !error && <p className="pl-loading">加载中…</p>}
      {projects && projects.length === 0 && (
        <SurfaceCard className="pl-empty">
          <p>还没有项目。先在受访者端创建访谈链接吧。</p>
        </SurfaceCard>
      )}
      {projects && projects.length > 0 && (
        <div className="pl-grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/dashboard/projects/${p.id}`} className="pl-card-link">
              <SurfaceCard className="pl-card">
                <h2 className="pl-card-name">{p.name}</h2>
                <p className="pl-card-time">{formatRelative(p.created_at)}</p>
                <div className="pl-card-stats">
                  <div>
                    <div className="pl-stat-num">{p.total}</div>
                    <div className="pl-stat-label">参与</div>
                  </div>
                  <div>
                    <div className="pl-stat-num">{p.completed}</div>
                    <div className="pl-stat-label">完成</div>
                  </div>
                  <div>
                    <div className="pl-stat-num">
                      {p.avg_duration_min === null ? '—' : `${p.avg_duration_min.toFixed(1)}m`}
                    </div>
                    <div className="pl-stat-label">平均时长</div>
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

export default ProjectsList;
