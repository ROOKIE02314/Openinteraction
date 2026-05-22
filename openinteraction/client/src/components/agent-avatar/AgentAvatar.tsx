import './agent-avatar.css';

export type EmotionState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy';

interface AgentAvatarProps {
  emotion: EmotionState;
}

function AgentAvatar({ emotion }: AgentAvatarProps) {
  return (
    <div className={`avatar avatar--${emotion}`} aria-label={`Agent is ${emotion}`}>
      <svg
        className="avatar-svg"
        viewBox="0 0 120 140"
        width="120"
        height="140"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Thought bubble — only visible in thinking state */}
        <circle
          className="avatar-bubble avatar-bubble-1"
          cx="90" cy="18"
          r="5"
        />
        <circle
          className="avatar-bubble avatar-bubble-2"
          cx="100" cy="8"
          r="3"
        />
        <circle
          className="avatar-bubble avatar-bubble-3"
          cx="106" cy="0"
          r="2"
        />

        {/* Head */}
        <circle
          className="avatar-head"
          cx="60" cy="65"
          r="45"
        />

        {/* Left eye */}
        <ellipse
          className="avatar-eye avatar-eye--left"
          cx="44" cy="58"
          rx="7" ry="7"
        />
        {/* Left eye highlight */}
        <circle
          className="avatar-eye-highlight avatar-eye-highlight--left"
          cx="42" cy="55"
          r="2.5"
        />

        {/* Right eye */}
        <ellipse
          className="avatar-eye avatar-eye--right"
          cx="76" cy="58"
          rx="7" ry="7"
        />
        {/* Right eye highlight */}
        <circle
          className="avatar-eye-highlight avatar-eye-highlight--right"
          cx="74" cy="55"
          r="2.5"
        />

        {/* Mouth */}
        <ellipse
          className="avatar-mouth"
          cx="60" cy="82"
          rx="12" ry="3"
        />
      </svg>
    </div>
  );
}

export default AgentAvatar;
