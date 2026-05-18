import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import Sparkline from '../../components/charts/Sparkline';
import { getDashboardOverview, type DashboardOverview } from '../../api/client';
import './analytics-overview.css';

function AnalyticsOverview() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardOverview()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, []);

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
    </DashboardLayout>
  );
}

export default AnalyticsOverview;
