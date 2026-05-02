const S = {
  page: {
    minHeight: '100dvh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 16, background: '#000',
  },
  card: {
    maxWidth: 440, width: '100%', padding: '48px 32px',
    textAlign: 'center' as const,
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: 16,
    background: 'rgba(51,51,51,0.9)', borderRadius: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.1)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  },
  title: { fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 },
  desc: { color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.65 },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 8 },
};

function CompletePage() {
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <path d="M14 20.5L18.5 25L26 17" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 style={S.title}>聊完啦，谢谢你！</h1>
        <p style={S.desc}>感谢你抽出时间分享使用体验，你的反馈对我们非常重要。每一条建议我们都会认真对待。</p>
        <p style={S.sub}>你可以关闭这个页面了</p>
      </div>
    </div>
  );
}

export default CompletePage;
