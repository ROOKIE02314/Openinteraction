import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useViewModelInstanceEnum,
  useViewModelInstanceNumber,
  useViewModelInstanceTrigger,
} from '@rive-app/react-canvas';
import PixelCompanion from '../pixel-companion/PixelCompanion';
import type { CompanionState } from '../pixel-companion/PixelCompanion';
import './rive-companion.css';

export interface RiveCompanionProps {
  state: CompanionState;
}

const STATE_LABELS: Record<CompanionState, string> = {
  idle: '访谈助手正在等你',
  listening: '访谈助手正在倾听',
  thinking: '访谈助手正在思考',
  speaking: '访谈助手正在回答',
  error: '访谈助手遇到了一点问题',
};

const COMPANION_LAYOUT = new Layout({
  fit: Fit.Contain,
  alignment: Alignment.Center,
});

const POINTER_RANGE_PX = 320;

function RiveCompanion({ state }: RiveCompanionProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const [isReady, setIsReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const handleRiveReady = useCallback(() => {
    setLoadFailed(false);
    setIsReady(true);
  }, []);

  const handleLoadError = useCallback(() => {
    setLoadFailed(true);
    setIsReady(false);
  }, []);

  const { rive, RiveComponent } = useRive({
    src: '/rive/ai-companion.riv',
    artboard: 'AI Companion',
    stateMachine: 'Companion Machine',
    autoplay: true,
    autoBind: true,
    layout: COMPANION_LAYOUT,
    shouldDisableRiveListeners: true,
    onRiveReady: handleRiveReady,
    onLoadError: handleLoadError,
  });

  const viewModelInstance = rive?.viewModelInstance;
  const { setValue: setMode } = useViewModelInstanceEnum('mode', viewModelInstance);
  const { setValue: setLookX } = useViewModelInstanceNumber('lookX', viewModelInstance);
  const { setValue: setLookY } = useViewModelInstanceNumber('lookY', viewModelInstance);
  const { trigger: triggerReaction } = useViewModelInstanceTrigger('react', viewModelInstance);

  useEffect(() => {
    setMode(state);
  }, [setMode, state]);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(motionPreference.matches);

    updateMotionPreference();
    motionPreference.addEventListener('change', updateMotionPreference);

    return () => motionPreference.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const resetGaze = () => {
      setLookX(0);
      setLookY(0);
    };

    const updateGaze = () => {
      pointerFrameRef.current = null;
      const button = buttonRef.current;
      if (!button || prefersReducedMotion) {
        resetGaze();
        return;
      }

      const rect = button.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const lookX = Math.max(-1, Math.min(1, (latestPointerRef.current.x - centerX) / POINTER_RANGE_PX));
      const lookY = Math.max(-1, Math.min(1, (latestPointerRef.current.y - centerY) / POINTER_RANGE_PX));

      setLookX(lookX);
      setLookY(lookY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || prefersReducedMotion) return;
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
      if (pointerFrameRef.current === null) {
        pointerFrameRef.current = window.requestAnimationFrame(updateGaze);
      }
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) resetGaze();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerout', handlePointerOut, { passive: true });
    window.addEventListener('blur', resetGaze);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerout', handlePointerOut);
      window.removeEventListener('blur', resetGaze);
      if (pointerFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerFrameRef.current);
      }
    };
  }, [prefersReducedMotion, setLookX, setLookY]);

  if (loadFailed || prefersReducedMotion) {
    return <PixelCompanion state={state} />;
  }

  const stateLabel = STATE_LABELS[state];

  return (
    <aside className="rive-companion-stage" aria-label="访谈助手角色">
      <button
        ref={buttonRef}
        type="button"
        className="rive-companion"
        onClick={triggerReaction}
        aria-label={`${stateLabel}，点击和我互动`}
      >
        <RiveComponent
          className={`rive-companion__canvas${isReady ? ' rive-companion__canvas--ready' : ''}`}
          aria-hidden="true"
          tabIndex={-1}
        />
        <span
          className={`rive-companion__placeholder${isReady ? ' rive-companion__placeholder--hidden' : ''}`}
          aria-hidden="true"
        >
          <span className="rive-companion__placeholder-eye rive-companion__placeholder-eye--left" />
          <span className="rive-companion__placeholder-eye rive-companion__placeholder-eye--right" />
        </span>
      </button>
      <span className="rive-companion__sr-only" aria-live="polite">
        {stateLabel}
      </span>
    </aside>
  );
}

export default RiveCompanion;
