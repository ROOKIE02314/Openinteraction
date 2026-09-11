import { useCallback, useEffect, useRef, useState } from 'react';
import './pixel-companion.css';

export type CompanionState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface PixelCompanionProps {
  state: CompanionState;
}

const STATE_LABELS: Record<CompanionState, string> = {
  idle: '访谈助手正在等你',
  listening: '访谈助手正在倾听',
  thinking: '访谈助手正在思考',
  speaking: '访谈助手正在回答',
  error: '访谈助手遇到了一点问题',
};

const EYE_RANGE = 4;

function PixelCompanion({ state }: PixelCompanionProps) {
  const companionRef = useRef<HTMLButtonElement>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReacting, setIsReacting] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resetEyes = () => {
      const companion = companionRef.current;
      if (!companion) return;
      companion.style.setProperty('--eye-x', '0px');
      companion.style.setProperty('--eye-y', '0px');
    };

    const updateEyes = () => {
      pointerFrameRef.current = null;
      const companion = companionRef.current;
      if (!companion || motionPreference.matches) {
        resetEyes();
        return;
      }

      const rect = companion.getBoundingClientRect();
      const deltaX = latestPointerRef.current.x - (rect.left + rect.width / 2);
      const deltaY = latestPointerRef.current.y - (rect.top + rect.height / 2);
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const strength = Math.min(distance / 320, 1);
      const eyeX = (deltaX / distance) * EYE_RANGE * strength;
      const eyeY = (deltaY / distance) * EYE_RANGE * strength;

      companion.style.setProperty('--eye-x', `${eyeX.toFixed(2)}px`);
      companion.style.setProperty('--eye-y', `${eyeY.toFixed(2)}px`);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || motionPreference.matches) return;
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
      if (pointerFrameRef.current === null) {
        pointerFrameRef.current = window.requestAnimationFrame(updateEyes);
      }
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) resetEyes();
    };

    const handleMotionPreferenceChange = () => {
      if (motionPreference.matches) resetEyes();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerout', handlePointerOut, { passive: true });
    window.addEventListener('blur', resetEyes);
    motionPreference.addEventListener('change', handleMotionPreferenceChange);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerout', handlePointerOut);
      window.removeEventListener('blur', resetEyes);
      motionPreference.removeEventListener('change', handleMotionPreferenceChange);
      if (pointerFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, []);

  const handleInteraction = useCallback(() => {
    if (isReacting) return;
    setIsReacting(true);
    reactionTimerRef.current = setTimeout(() => {
      setIsReacting(false);
      reactionTimerRef.current = null;
    }, 500);
  }, [isReacting]);

  const stateLabel = STATE_LABELS[state];

  return (
    <aside className="pixel-companion-stage" aria-label="访谈助手角色">
      <button
        ref={companionRef}
        type="button"
        className={`pixel-companion pixel-companion--${state}${isReacting ? ' pixel-companion--reacting' : ''}`}
        onClick={handleInteraction}
        aria-label={`${stateLabel}，点击和我互动`}
      >
        <span className="pixel-companion__float">
          <span className="pixel-companion__motion">
            <svg
              className="pixel-companion__sprite"
              viewBox="0 0 120 120"
              aria-hidden="true"
            >
              <defs>
                <pattern id="companion-grain" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
                  <circle cx="0.65" cy="0.65" r="0.28" fill="#a88400" opacity="0.18" />
                  <circle cx="1.85" cy="1.85" r="0.2" fill="#6f5200" opacity="0.12" />
                </pattern>
              </defs>
              <circle className="pixel-companion__body" cx="60" cy="60" r="55" />
              <g className="pixel-companion__state-eyes">
                <g className="pixel-companion__pointer-eyes">
                  <ellipse
                    className="pixel-companion__eye pixel-companion__eye--left"
                    cx="44"
                    cy="63"
                    rx="9"
                    ry="5"
                  />
                  <ellipse
                    className="pixel-companion__eye pixel-companion__eye--right"
                    cx="76"
                    cy="63"
                    rx="9"
                    ry="5"
                  />
                </g>
              </g>
              <circle className="pixel-companion__grain" cx="60" cy="60" r="55" />
            </svg>
          </span>
        </span>
      </button>
      <span className="pixel-companion__sr-only" aria-live="polite">
        {stateLabel}
      </span>
    </aside>
  );
}

export default PixelCompanion;
