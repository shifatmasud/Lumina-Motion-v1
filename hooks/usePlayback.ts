
import { useState, useEffect, useRef } from 'react';
import { SceneObject } from '../engine';

export const usePlayback = (objects: SceneObject[]) => {
  const [totalDuration, setTotalDuration] = useState(5); // in seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  useEffect(() => {
    const endTimes = objects.map(o => o.startTime + o.duration);
    const maxEndTime = Math.max(0, ...endTimes);
    setTotalDuration(Math.max(5, maxEndTime));
  }, [objects]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (now: number) => {
        const delta = (now - (lastTimeRef.current ?? now)) / 1000;
        lastTimeRef.current = now;
        setCurrentTime(prev => {
          const newTime = prev + delta;
          if (newTime >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return newTime;
        });
        animationFrameRef.current = requestAnimationFrame(loop);
      };
      animationFrameRef.current = requestAnimationFrame(loop);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, totalDuration]);

  return {
    totalDuration,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying
  };
};
