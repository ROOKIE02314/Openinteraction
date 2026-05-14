import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import MessageList, { type Message } from '../../components/message-list/MessageList';
import MessageInput from '../../components/message-input/MessageInput';
import {
  getProjectMetrics,
  getDashboardChats,
  askDashboard,
  clearDashboardChats,
  type ProjectMetrics,
  type KeywordEntry,
} from '../../api/client';
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
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastTruncation, setLastTruncation] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getProjectMetrics(id), getDashboardChats(id)])
      .then(([m, chats]) => {
        setMetrics(m);
        setChatMessages(chats.map(c => ({ role: c.role, content: c.content })));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, [id]);

  const handleChipClick = (label: string) => {
    setDraftQuestion(`为什么用户提到「${label}」？`);
    document.querySelector<HTMLTextAreaElement>('.pd-right .msg-input-field')?.focus();
  };

  const handleSend = async (text: string) => {
    if (!id) return;
    const next: Message[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(next);
    setChatLoading(true);
    setChatError(null);
    try {
      const resp = await askDashboard(id, text);
      setChatMessages([...next, { role: 'assistant', content: resp.answer }]);
      setLastTruncation(resp.truncated ? resp.dropped_count : null);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : '发送失败，请重试');
      setChatMessages(prev => prev.slice(0, prev.length - 1)); // roll back the user bubble
    } finally {
      setChatLoading(false);
    }
  };

  const handleClear = async () => {
    if (!id) return;
    if (!window.confirm('清空当前项目的所有问答？此操作不可撤销。')) return;
    try {
      await clearDashboardChats(id);
      setChatMessages([]);
      setLastTruncation(null);
      setChatError(null);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : '清空失败，请重试');
    }
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
  const noInterviews = metrics.overview.total === 0;

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
          <SurfaceCard className="pd-qa-card">
            <header className="pd-qa-header">
              <h2 className="pd-section-title">问研究助手</h2>
              {chatMessages.length > 0 && (
                <button
                  type="button"
                  className="pd-toggle-btn"
                  onClick={handleClear}
                >
                  清空对话
                </button>
              )}
            </header>
            <div className="pd-qa-body">
              {noInterviews ? (
                <p className="pd-empty-text">该项目还没有访谈数据</p>
              ) : (
                <MessageList messages={chatMessages} loading={chatLoading} />
              )}
            </div>
            {lastTruncation !== null && (
              <p className="pd-qa-truncation">已基于最近 {metrics.interviews.length - lastTruncation} 次访谈回答</p>
            )}
            {chatError && <div className="pd-qa-error" role="alert">{chatError}</div>}
            <MessageInput
              onSend={handleSend}
              disabled={noInterviews || chatLoading}
              value={draftQuestion}
              onValueChange={setDraftQuestion}
            />
          </SurfaceCard>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default ProjectDetail;
