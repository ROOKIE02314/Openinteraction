import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInterview } from '../../api/client';
import type { Interview } from '../../api/client';

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: '#000',
  },
  card: {
    maxWidth: 440,
    width: '100%',
    padding: '48px 32px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    background: 'rgba(51,51,51,0.9)',
    borderRadius: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  icon: {
    fontSize: 40,
    lineHeight: '1',
    marginBottom: 8,
    color: 'rgba(255,255,255,0.4)',
    userSelect: 'none',
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.3,
  },
  desc: {
    maxWidth: 360,
    margin: '0 auto',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    lineHeight: 1.65,
  },
  duration: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 8,
  },
  btn: {
    marginTop: 24,
    padding: '12px 48px',
    border: 'none',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.85)',
    color: '#000',
    fontFamily: 'Inter, sans-serif',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
  },
  loader: {
    width: 48,
    height: 48,
    border: '2px solid rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.4)',
    borderRadius: '50%',
  },
};

function LandingPage() {
  const { token } = useParams();
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
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{
            ...styles.loader,
            animation: 'landingSpin 0.8s linear infinite',
          }} />
          <style>{'@keyframes landingSpin{to{transform:rotate(360deg)}}'}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, gap: 12 }}>
          <p style={styles.icon}>—</p>
          <h1 style={styles.title}>链接无效</h1>
          <p style={styles.desc}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={styles.icon}>,</p>
        <h1 style={{ ...styles.title, marginBottom: 8 }}>Hi，想跟你聊聊~</h1>
        <p style={styles.desc}>
          我们想了解一下你使用「{interview?.project_name}」的体验，
          就像朋友间随便聊聊，没有标准答案，想到什么说什么就好。
        </p>
        <p style={styles.duration}>大概需要 10－15 分钟</p>
        <button style={styles.btn} onClick={handleStart}>
          开始聊天
        </button>
      </div>
    </div>
  );
}

export default LandingPage;
