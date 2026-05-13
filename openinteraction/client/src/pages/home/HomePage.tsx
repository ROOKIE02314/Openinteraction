import './home.css';

function HomePage() {
  return (
    <div className="home">
      <div className="home-card">
        <div className="home-badge" aria-hidden="true" />
        <h1 className="home-title">产品体验访谈</h1>
        <p className="home-desc">通过自然对话收集用户反馈的 AI 访谈系统</p>
        <p className="home-hint">请使用访谈分享链接访问，或通过 API 创建新的访谈</p>
      </div>
    </div>
  );
}

export default HomePage;
