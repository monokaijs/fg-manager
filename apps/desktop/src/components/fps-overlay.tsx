import { useEffect, useState } from 'react';

export function FpsOverlay() {
  const [fps, setFps] = useState(0);
  const [drops, setDrops] = useState(0);
  const [longTasks, setLongTasks] = useState(0);
  const [layoutShifts, setLayoutShifts] = useState(0);
  
  useEffect(() => {
    // Advanced Chrome Observers
    try {
      new PerformanceObserver((list) => setLongTasks(p => p + list.getEntries().length))
        .observe({ type: 'longtask', buffered: true });
    } catch(e) {}

    try {
      new PerformanceObserver((list) => {
        let shifts = 0;
        // @ts-ignore
        list.getEntries().forEach(e => { if (!e.hadRecentInput) shifts++ });
        if (shifts > 0) setLayoutShifts(p => p + shifts);
      }).observe({ type: 'layout-shift', buffered: true });
    } catch(e) {}

    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measure = (time: number) => {
      frameCount++;
      const delta = time - lastTime;
      
      if (delta >= 1000) {
        const currentFps = Math.round((frameCount * 1000) / delta);
        setFps(currentFps);
        if (currentFps < 50) setDrops(d => d + 1);
        frameCount = 0;
        lastTime = time;
      }
      animationFrameId = requestAnimationFrame(measure);
    };

    animationFrameId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] bg-black/80 text-white px-3 py-1.5 rounded-full text-xs font-mono border border-white/20 shadow-xl flex gap-4 pointer-events-none divide-x divide-white/20">
      <span className={fps < 30 ? 'text-red-400 font-bold' : fps < 50 ? 'text-yellow-400' : 'text-green-400'}>
        FPS: {fps}
      </span>
      <span className={`pl-4 ${longTasks > 0 ? 'text-orange-400 font-bold' : 'text-muted-foreground'}`}>
        LongTasks(JS): {longTasks}
      </span>
      <span className={`pl-4 ${layoutShifts > 0 ? 'text-red-400 font-bold' : 'text-muted-foreground'}`}>
        LayoutShifts: {layoutShifts}
      </span>
    </div>
  );
}
