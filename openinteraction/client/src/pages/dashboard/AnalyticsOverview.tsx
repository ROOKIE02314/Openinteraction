import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import Sparkline from '../../components/charts/Sparkline';
import { getDashboardOverview, type DashboardOverview } from '../../api/client';
import { useNavigate, Link } from 'react-router-dom';
import './analytics-overview.css';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatAbsolute(iso: string): string {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function statusBadgeClass(status: 'in_progress' | 'completed' | 'abandoned'): string {
  if (status === 'in_progress') return 'ao-status-badge ao-status-badge--inprogress';
  if (status === 'abandoned') return 'ao-status-badge ao-status-badge--abandoned';
  return 'ao-status-badge';
}

function statusLabel(status: 'in_progress' | 'completed' | 'abandoned'): string {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'abandoned') return 'Abandoned';
  return 'Completed';
}

function AnalyticsOverview() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'abandoned'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    getDashboardOverview()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, []);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'all') return data.recent_interviews;
    return data.recent_interviews.filter(r => r.status === statusFilter);
  }, [data, statusFilter]);

  if (error) {
    return (
      <DashboardLayout title="Interview Analytics" subtitle="Product Research Insights Overview">
        <p className="ao-error" role="alert">{error}</p>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout title="Interview Analytics" subtitle="Product Research Insights Overview">
        <p className="ao-loading">加载中…</p>
      </DashboardLayout>
    );
  }

  const growth = data.interview_growth_pct;
  const showGrowthPill = growth !== null && growth !== 0;

  return (
    <DashboardLayout title="Interview Analytics" subtitle="Product Research Insights Overview">
      <section className="ao-kpi-row">
        <SurfaceCard className="ao-kpi-card">
          <div>
            <span className="ao-kpi-label">Total Interviews</span>
            <h2 className="ao-kpi-value">{data.total_interviews.toLocaleString()}</h2>
          </div>
          {showGrowthPill && (
            <div className="ao-kpi-foot">
              <span className={`ao-growth-pill${growth! < 0 ? ' ao-growth-pill--neg' : ''}`}>
                {growth! > 0 ? '+' : ''}{growth}% vs last month
              </span>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard className="ao-kpi-card">
          <div>
            <span className="ao-kpi-label">Active Sessions</span>
            <h2 className="ao-kpi-value">{data.in_progress_interviews}</h2>
          </div>
          <div className="ao-kpi-foot">
            <div className={`ao-pulse-dot${data.in_progress_interviews === 0 ? ' ao-pulse-dot--idle' : ''}`} />
            <span className="ao-kpi-foot-text">Live monitoring enabled</span>
          </div>
        </SurfaceCard>

        <SurfaceCard className="ao-kpi-card">
          <div>
            <span className="ao-kpi-label">Total Projects</span>
            <h2 className="ao-kpi-value">{data.total_projects}</h2>
          </div>
          <div className="ao-kpi-foot">
            <span className="ao-kpi-foot-text">Across research workstreams</span>
          </div>
        </SurfaceCard>
      </section>

      <section className="ao-mid-row">
        <SurfaceCard className="ao-chart-card">
          <div className="ao-chart-card-head">
            <div>
              <h3 className="ao-card-title">Interview Frequency</h3>
              <p className="ao-card-subtitle">Monthly breakdown of conducted sessions</p>
            </div>
          </div>
          <div className="ao-chart-body">
            <Sparkline points={data.monthly_interviews} />
          </div>
        </SurfaceCard>

        <SurfaceCard className="ao-tags-card">
          <h3 className="ao-card-title">Trending Topics</h3>
          <div className="ao-tags-cloud" style={{ marginTop: 'var(--space-4)' }}>
            {data.trending_tags.length === 0 && (
              <p className="ao-tags-empty">No annotations yet — insights will appear as interviews complete.</p>
            )}
            {data.trending_tags.map((tag, idx) => (
              <span
                key={tag.label}
                className={`ao-tag-pill${idx < 2 ? ' ao-tag-pill--strong' : ''}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
          <div className="ao-tags-foot">
            <span className="ao-tags-foot-label">Total Keywords</span>
            <span className="ao-tags-foot-value">{data.total_keyword_count}</span>
          </div>
        </SurfaceCard>
      </section>

      <SurfaceCard className="ao-table-card">
        <div className="ao-table-head">
          <h3 className="ao-card-title">Recent Interviews</h3>
          <div className="ao-table-head-actions">
            <button className="ao-table-icon-btn" disabled aria-label="Search (coming soon)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21 21-4.3-4.3" />
                <circle cx="10" cy="10" r="7" />
              </svg>
            </button>
            <select
              className="ao-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>
        </div>
        <div className="ao-table-scroll">
          {data.recent_interviews.length === 0 && (
            <div className="ao-table-empty">
              No interviews yet. <Link to="/dashboard/projects">Share a project link</Link> to get started.
            </div>
          )}
          {data.recent_interviews.length > 0 && (
            <table className="ao-table">
              <thead>
                <tr>
                  <th>Interview ID</th>
                  <th>Topic / Subject</th>
                  <th>Project</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} onClick={() => navigate(`/dashboard/projects/${row.project_id}`)}>
                    <td className="ao-cell-mono">{row.short_id}</td>
                    <td className="ao-cell-medium">{row.project_name}</td>
                    <td><span className="ao-project-chip">{row.project_name}</span></td>
                    <td>{formatAbsolute(row.started_at)}</td>
                    <td><span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SurfaceCard>
    </DashboardLayout>
  );
}

export default AnalyticsOverview;
