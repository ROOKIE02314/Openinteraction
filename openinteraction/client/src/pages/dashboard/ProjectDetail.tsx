import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import { getProjectMetrics, type ProjectMetrics, type KeywordEntry } from '../../api/client';
import './project-detail.css';

const KEYWORD_GROUPS: Array<{ key: keyof ProjectMetrics['keywords']; title: string }> = [
  { key: 'pain_point', title: '痛点' },
  { key: 'feature_request', title: '功能诉求' },
  { key: 'positive_feedback', title: '正向反馈' },
];

function formatRate(r: number | null): string {
  return r === null ? '—' : `${(r * 100).toFixed(0)}%`;
}

function formatNum(n: number | null, suffix = ''): string {
  return n === null ? '—' : `${n.toFixed(1)}${suffix}`;
}

function ProjectDetail() {
  const { id } = useParams();
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllInterviews, setShowAllInterviews] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState('');

  useEffect(() => {
    if (!id) return;
    getProjectMetrics(id)
      .then(setMetrics)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, [id]);

  const handleChipClick = (label: string) => {
    setDraftQuestion(`为什么用户提到「${label}」？`);
    document.getElementById('pd-qa-input')?.focus();
  };

  if (error) {
    return (
      <DashboardLayout breadcrumb={<Link to="/dashboard">← 返回</Link>}>
        <p className="pd-error" role="alert">{error}</p>
      </DashboardLayout>
    );
  }

  if (!metrics) {
    return (
      <DashboardLayout breadcrumb={<Link to="/dashboard">← 返回</Link>}>
        <p className="pd-loading">加载中…</p>
      </DashboardLayout>
    );
  }

  const o = metrics.overview;
  const interviewsToShow = showAllInterviews ? metrics.interviews : metrics.interviews.slice(0, 5);

  return (
    <DashboardLayout breadcrumb={<><Link to="/dashboard">研究项目</Link> / {metrics.project.name}</>}>
      <div className="pd-grid">
        <section className="pd-left">
          <h1 className="pd-title">{metrics.project.name}</h1>

          <div className="pd-overview-row">
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{o.total}</div>
              <div className="pd-stat-label">参与人数</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatRate(o.completion_rate)}</div>
              <div className="pd-stat-label">完成率</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatNum(o.avg_duration_min, 'm')}</div>
              <div className="pd-stat-label">平均时长</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatNum(o.avg_messages_per_interview)}</div>
              <div className="pd-stat-label">平均消息数</div>
            </SurfaceCard>
          </div>

          <SurfaceCard className="pd-section">
            <h2 className="pd-section-title">关键词</h2>
            <div className="pd-chip-groups">
              {KEYWORD_GROUPS.map(g => {
                const entries: KeywordEntry[] = metrics.keywords[g.key];
                return (
                  <div key={g.key} className="pd-chip-group">
                    <h3 className="pd-chip-group-title">{g.title}</h3>
                    {entries.length === 0 ? (
                      <p className="pd-empty-text">暂无标注</p>
                    ) : (
                      <div className="pd-chips">
                        {entries.map(e => (
                          <button
                            key={e.label}
                            className="pd-chip"
                            type="button"
                            onClick={() => handleChipClick(e.label)}
                          >
                            <span className="pd-chip-label">{e.label}</span>
                            <span className="pd-chip-count">{e.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard className="pd-section">
            <header className="pd-section-header">
              <h2 className="pd-section-title">访谈记录</h2>
              {metrics.interviews.length > 5 && (
                <button
                  className="pd-toggle-btn"
                  type="button"
                  onClick={() => setShowAllInterviews(v => !v)}
                >
                  {showAllInterviews ? '收起' : `展开全部 (${metrics.interviews.length})`}
                </button>
              )}
            </header>
            {metrics.interviews.length === 0 ? (
              <p className="pd-empty-text">暂无访谈</p>
            ) : (
              <table className="pd-iv-table">
                <thead>
                  <tr>
                    <th>开始时间</th>
                    <th>状态</th>
                    <th>时长</th>
                    <th>洞察数</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewsToShow.map(iv => (
                    <tr key={iv.id}>
                      <td>{iv.started_at}</td>
                      <td>{iv.status}</td>
                      <td>{iv.duration_min === null ? '—' : `${iv.duration_min.toFixed(1)}m`}</td>
                      <td>{iv.insight_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SurfaceCard>
        </section>

        <section className="pd-right">
          <SurfaceCard className="pd-qa-placeholder">
            <p>AI 问答（下一步实现）</p>
            <p className="pd-empty-text">草稿: {draftQuestion || '—'}</p>
          </SurfaceCard>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default ProjectDetail;
