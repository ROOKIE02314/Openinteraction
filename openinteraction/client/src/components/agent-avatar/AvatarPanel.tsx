import AgentAvatar from './AgentAvatar';
import type { EmotionState } from './AgentAvatar';
import './avatar-panel.css';

interface AvatarPanelProps {
  emotion: EmotionState;
}

const emotionLabels: Record<EmotionState, string> = {
  idle: '',
  listening: '在听你说...',
  thinking: '让我想想...',
  speaking: '',
  happy: '聊得很开心！',
};

function AvatarPanel({ emotion }: AvatarPanelProps) {
  const label = emotionLabels[emotion];

  return (
    <aside className="avatar-panel">
      <AgentAvatar emotion={emotion} />
      {label && <p className="avatar-panel-label">{label}</p>}
    </aside>
  );
}

export default AvatarPanel;
