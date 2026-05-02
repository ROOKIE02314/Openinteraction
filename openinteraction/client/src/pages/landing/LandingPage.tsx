import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInterview } from '../../api/client';
import type { Interview } from '../../api/client';
import SurfaceCard from '../../components/surface/SurfaceCard';
import './landing.css';

function LandingPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    getInterview(token)
      .then((data) => {
        setInterview(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '访谈链接无效或已过期');
        setLoading(false);
      });
  }, [token]);

  const handleStart = () => {
    if (!token) return;
    navigate(`/interview/${token}/chat`, { state: { interview } });
  };

  if (loading) {
    return (
      <div className="landing">
        <SurfaceCard className="landing-card">
          <div className="landing-loader" />
        </SurfaceCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="landing">
        <SurfaceCard className="landing-card landing-card--error">
          <p className="landing-card-icon">—</p>
          <h1>链接无效</h1>
          <p>{error}</p>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="landing">
      <SurfaceCard className="landing-card">
        <p className="landing-card-icon">,</p>
        <h1 className="landing-title">Hi，想跟你聊聊~</h1>
        <p className="landing-desc">
          我们想了解一下你使用「{interview?.project_name}」的体验，
          就像朋友间随便聊聊，没有标准答案，想到什么说什么就好。
        </p>
        <p className="landing-duration">大概需要 10－15 分钟</p>
        <button className="landing-btn" onClick={handleStart}>
          开始聊天
        </button>
      </SurfaceCard>
    </div>
  );
}

export default LandingPage;
