export interface DownloadTask {
  id: string; 
  gameSlug?: string;
  name: string;
  status: 'downloading' | 'paused' | 'completed' | 'error' | 'checking' | 'queued' | 'stalled';
  progress: number; // 0 to 1
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number; // bytes/sec
  eta: number; // seconds
  totalSize: number;
  downloaded: number;
  peers?: number;
  seeds?: number;
}

export interface DownloaderAdapter {
  id: string;
  name: string;
  
  init(): Promise<boolean>;
  isAvailable(): Promise<boolean>;
  
  addMagnet(magnet: string, gameSlug?: string): Promise<boolean>;
  addTorrent(torrentUrl: string, gameSlug?: string): Promise<boolean>;
  
  pause(id: string): Promise<boolean>;
  resume(id: string): Promise<boolean>;
  remove(id: string, deleteFiles: boolean): Promise<boolean>;
  
  getTasks(): Promise<DownloadTask[]>;
}
