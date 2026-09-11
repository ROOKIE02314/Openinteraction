import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import './audio-player.css';

export interface AudioPlayerHandle {
  enqueueChunk: (base64Chunk: string) => void;
  stop: () => void;
  replay: (allChunks: string[]) => void;
}

export interface AudioPlayerProps {
  onPlaybackStateChange?: (playing: boolean) => void;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { onPlaybackStateChange },
  ref,
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const scheduledRef = useRef<AudioBufferSourceNode[]>([]);
  const isPlayingRef = useRef(false);
  const nextTimeRef = useRef(0);

  const updatePlaying = useCallback((playing: boolean) => {
    if (isPlayingRef.current === playing) return;
    isPlayingRef.current = playing;
    onPlaybackStateChange?.(playing);
  }, [onPlaybackStateChange]);

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const scheduleBuffer = useCallback((ctx: AudioContext, buffer: AudioBuffer) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextTimeRef.current);
    source.start(startTime);
    nextTimeRef.current = startTime + buffer.duration;

    scheduledRef.current.push(source);
    updatePlaying(true);

    source.onended = () => {
      scheduledRef.current = scheduledRef.current.filter((s) => s !== source);
      if (scheduledRef.current.length === 0) {
        nextTimeRef.current = 0;
        updatePlaying(false);
      }
    };
  }, [updatePlaying]);

  const enqueueChunk = useCallback((base64Chunk: string) => {
    const ctx = getCtx();

    const binary = atob(base64Chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    ctx.decodeAudioData(bytes.buffer).then((buffer) => {
      scheduleBuffer(ctx, buffer);
    });
  }, [getCtx, scheduleBuffer]);

  const stop = useCallback(() => {
    scheduledRef.current.forEach((s) => {
      try { s.stop(); } catch { /* already stopped */ }
    });
    scheduledRef.current = [];
    nextTimeRef.current = 0;
    updatePlaying(false);

    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close();
      ctxRef.current = null;
    }
  }, [updatePlaying]);

  const replay = useCallback((allChunks: string[]) => {
    stop();
    allChunks.forEach((chunk) => enqueueChunk(chunk));
  }, [stop, enqueueChunk]);

  useImperativeHandle(ref, () => ({ enqueueChunk, stop, replay }), [enqueueChunk, stop, replay]);

  return null;
});

export default AudioPlayer;
