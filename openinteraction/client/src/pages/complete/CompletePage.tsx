import SurfaceCard from '../../components/surface/SurfaceCard';
import './complete.css';

function CompletePage() {
  return (
    <div className="complete">
      <SurfaceCard className="complete-card">
        <div className="complete-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <path
              d="M14 20.5L18.5 25L26 17"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1>聊完啦，谢谢你！</h1>
        <p>
          感谢你抽出时间分享使用体验，你的反馈对我们非常重要。
          每一条建议我们都会认真对待。
        </p>
        <p className="complete-sub">你可以关闭这个页面了</p>
      </SurfaceCard>
    </div>
  );
}

export default CompletePage;
