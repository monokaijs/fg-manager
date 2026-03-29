import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDownloadStore } from "@/stores/downloadStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useGamesStore } from "@/store/useGamesStore";
import { DownloadTaskRow } from "@/components/download-task-row";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { DownloadTask } from "@/lib/downloads/types";
import { formatBytes } from "@/lib/utils";

type Sample = {
  at: number;
  downloadedById: Record<string, number>;
};

export default function DownloadsView() {
  const { tasks, pause, resume, remove, moveQueueItem } = useDownloadStore();
  const { games } = useGamesStore();
  const downloadPath = useSettingsStore((state) => state.downloadPath);
  const { t } = useI18n();
  const [diskSpeed, setDiskSpeed] = useState(0);
  const [peakNetworkSpeed, setPeakNetworkSpeed] = useState(0);
  const [networkHistory, setNetworkHistory] = useState<number[]>(() => Array(60).fill(0));
  const [diskHistory, setDiskHistory] = useState<number[]>(() => Array(60).fill(0));
  const sampleRef = useRef<Sample | null>(null);
  const networkSpeedRef = useRef(0);
  const diskSpeedRef = useRef(0);

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'error');
  const downloadingNow = activeTasks.filter((task) => ['downloading', 'checking', 'extracting', 'installing'].includes(task.status)).length;
  const queuedCount = activeTasks.filter((task) => task.status === 'queued').length;
  const pausedCount = activeTasks.filter((task) => task.status === 'paused').length;

  const networkSpeed = useMemo(
    () => activeTasks.reduce((total, task) => total + (task.downloadSpeed || 0), 0),
    [activeTasks]
  );

  const totalQueueBytes = useMemo(
    () => activeTasks.reduce((total, task) => total + Math.max(0, task.totalSize || 0), 0),
    [activeTasks]
  );
  const downloadedQueueBytes = useMemo(
    () => activeTasks.reduce((total, task) => total + Math.max(0, task.downloaded || 0), 0),
    [activeTasks]
  );
  const queueProgress = totalQueueBytes > 0 ? (downloadedQueueBytes / totalQueueBytes) * 100 : 0;

  const chartWidth = 1000;
  const chartHeight = 220;

  const chartMax = useMemo(() => {
    const peak = Math.max(1, ...networkHistory, ...diskHistory);
    return peak * 1.15;
  }, [networkHistory, diskHistory]);

  const pivots = useMemo(() => [1, 0.75, 0.5, 0.25, 0].map((ratio) => ratio * chartMax), [chartMax]);

  const speedToY = (speed: number) => {
    const clamped = Math.max(0, Math.min(chartMax, speed));
    return chartHeight - (clamped / chartMax) * chartHeight;
  };

  const makeLinePoints = (series: number[]) => {
    const total = Math.max(1, series.length - 1);
    return series
      .map((value, index) => `${(index / total) * chartWidth},${speedToY(value)}`)
      .join(' ');
  };

  const networkLinePoints = useMemo(() => makeLinePoints(networkHistory), [networkHistory, chartMax]);
  const diskLinePoints = useMemo(() => makeLinePoints(diskHistory), [diskHistory, chartMax]);

  useEffect(() => {
    setPeakNetworkSpeed((prev) => Math.max(prev, networkSpeed));
  }, [networkSpeed]);

  useEffect(() => {
    networkSpeedRef.current = networkSpeed;
  }, [networkSpeed]);

  useEffect(() => {
    diskSpeedRef.current = diskSpeed;
  }, [diskSpeed]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNetworkHistory((prev) => [...prev.slice(1), networkSpeedRef.current]);
      setDiskHistory((prev) => [...prev.slice(1), diskSpeedRef.current]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const now = Date.now();
    const current: Sample = {
      at: now,
      downloadedById: Object.fromEntries(activeTasks.map((task) => [task.id, task.downloaded || 0])),
    };

    if (!sampleRef.current) {
      sampleRef.current = current;
      return;
    }

    const elapsedSeconds = (now - sampleRef.current.at) / 1000;
    if (elapsedSeconds <= 0) {
      sampleRef.current = current;
      return;
    }

    let deltaBytes = 0;
    for (const task of activeTasks) {
      const previous = sampleRef.current.downloadedById[task.id] || 0;
      const delta = (task.downloaded || 0) - previous;
      if (delta > 0) deltaBytes += delta;
    }

    setDiskSpeed(deltaBytes / elapsedSeconds);
    sampleRef.current = current;
  }, [activeTasks]);

  const openDownloadsFolder = async () => {
    try {
      await invoke('open_folder_path', { path: downloadPath });
    } catch {
      toast.error('Failed to open download folder.');
    }
  };

  const openTaskFolder = async (task: DownloadTask) => {
    try {
      const targetPath = task.savePath ?? downloadPath;
      if (!targetPath) {
        toast.error('No folder path available for this download yet.');
        return;
      }
      await invoke('reveal_in_folder', { path: targetPath });
    } catch {
      toast.error('Failed to open item folder.');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header
        className="flex h-16 shrink-0 items-center px-8 border-b border-border bg-background z-50 relative"
      >
        <SidebarTrigger className="mr-4" />
        <h2 className="text-lg font-semibold tracking-tight">{t('downloads.title', { count: activeTasks.length })}</h2>
        <Button variant="outline" className="ml-auto" onClick={openDownloadsFolder}>
          {t('downloads.openDownloadFolder')}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto w-full" style={{ willChange: 'scroll-position', transform: 'translateZ(0)', scrollBehavior: 'smooth' }}>
        <div className="p-8 pb-2">
          <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-card to-card/60 shadow-sm overflow-hidden">
            <div className="p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm tracking-[0.2em] uppercase text-muted-foreground">{t('downloads.transferTitle')}</h3>
                  <p className="text-lg font-semibold mt-1">{t('downloads.transferSubtitle')}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('downloads.queueSummary', { downloading: downloadingNow, queued: queuedCount, paused: pausedCount })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('downloads.networkSpeed')}</div>
                  <div className="text-2xl font-bold mt-1">{formatBytes(networkSpeed)}/s</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('downloads.diskSpeed')}</div>
                  <div className="text-2xl font-bold mt-1">{formatBytes(diskSpeed)}/s</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('downloads.peakNetworkSpeed')}</div>
                  <div className="text-2xl font-bold mt-1">{formatBytes(peakNetworkSpeed)}/s</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>{t('downloads.totalQueueProgress')}</span>
                  <span>{queueProgress.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, queueProgress))}%` }} />
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-sm font-semibold tracking-wide">{t('downloads.speedHistoryTitle')}</h4>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-0.5 bg-sky-500" />
                      <span>{t('downloads.networkLine')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-0.5 bg-emerald-500" />
                      <span>{t('downloads.diskLine')}</span>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-56">
                    {pivots.map((pivot) => {
                      const y = speedToY(pivot);
                      return (
                        <g key={`pivot-${pivot}`}>
                          <line x1={0} y1={y} x2={chartWidth} y2={y} className="stroke-border/70" strokeDasharray="4 4" />
                          <text x={6} y={Math.max(12, y - 4)} className="fill-muted-foreground text-[10px]">
                            {formatBytes(pivot)}/s
                          </text>
                        </g>
                      );
                    })}

                    {[0, 250, 500, 750, 1000].map((x) => (
                      <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={chartHeight} className="stroke-border/35" />
                    ))}

                    <polyline points={networkLinePoints} fill="none" stroke="rgb(14 165 233)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                    <polyline points={diskLinePoints} fill="none" stroke="rgb(16 185 129)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>

                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground px-1">
                    <span>{t('downloads.secondsAgo', { sec: 60 })}</span>
                    <span>{t('downloads.secondsAgo', { sec: 45 })}</span>
                    <span>{t('downloads.secondsAgo', { sec: 30 })}</span>
                    <span>{t('downloads.secondsAgo', { sec: 15 })}</span>
                    <span>{t('downloads.now')}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-2">
              <Download className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium tracking-tight">{t('downloads.noActiveTitle')}</h3>
            <p className="text-muted-foreground max-w-sm">
              {t('downloads.noActiveDescription')}
            </p>
          </div>
        ) : (
          <div className="p-8 pt-4 space-y-4">
            {activeTasks.map((task) => {
              const game = games.find(g => g.slug === task.gameSlug);

              return (
                 <DownloadTaskRow
                   key={task.id}
                   task={task}
                   game={game}
                   onPause={pause}
                   onResume={resume}
                   onRemove={remove}
                   onOpenFolder={openTaskFolder}
                   onMoveQueue={moveQueueItem}
                 />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
