import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settingsStore";
import { useEffect, useState } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { HardDrive, Network, RotateCcw, FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

export default function SettingsView() {
  const { 
    qbUrl, qbUsername, qbPassword, setQbConfig, 
    downloadPath, setDownloadPath,
    startWithWindows, setStartWithWindows,
    hideOnStartup, setHideOnStartup,
    downloadSpeedLimit, setDownloadSpeedLimit
  } = useSettingsStore();

  const [displayPath, setDisplayPath] = useState(downloadPath || "Loading...");
  
  const [localUrl, setLocalUrl] = useState(qbUrl);
  const [localUser, setLocalUser] = useState(qbUsername);
  const [localPass, setLocalPass] = useState(qbPassword);

  useEffect(() => {
    if (!downloadPath) {
      appDataDir().then(dir => {
        join(dir, "downloads").then(path => {
            setDownloadPath(path);
            setDisplayPath(path);
        });
      }).catch(() => {
        setDisplayPath("Failed to resolve path");
      });
    } else {
      setDisplayPath(downloadPath);
    }
  }, [downloadPath]);

  const handleSaveNetwork = () => {
    setQbConfig(localUrl, localUser, localPass);
    toast.success("Network settings saved! Updates synced with Adapter Orchestrator.");
  };

  const handleReset = () => {
    setLocalUrl('http://127.0.0.1:8080');
    setLocalUser('');
    setLocalPass('');
    setQbConfig('http://127.0.0.1:8080', '', '');
    toast.info("Network settings reset back to defaults.");
  };

  const openFolder = async () => {
      try {
          const selectedDirPath = await open({
            directory: true,
            multiple: false,
            title: "Select Games Download Directory"
          });
          
          if (selectedDirPath) {
              setDownloadPath(selectedDirPath as string);
              toast.success(`Download path updated to ${selectedDirPath}`);
          }
      } catch (e) {
          toast.error("Failed to open dialog or set path");
      }
  };

  return (
    <>
      <header
        data-tauri-drag-region
        className="flex h-16 shrink-0 items-center px-8 border-b border-border bg-background/95 backdrop-blur z-50 sticky top-0 transition-[padding] duration-200"
      >
        <SidebarTrigger className="mr-4" />
        <h2 className="text-lg font-semibold tracking-tight">System Settings</h2>
      </header>
      
      <div className="p-8 max-w-4xl space-y-12 pb-24 mx-auto w-full">

        {/* System Autostart */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-border/50 pb-2 mb-4">
             <RotateCcw className="h-5 w-5 text-primary" />
             <h3 className="text-lg font-semibold tracking-tight">System Behavior</h3>
          </div>
          <p className="text-sm text-muted-foreground mr-10 leading-relaxed max-w-2xl">
            Configure how the Manager behaves when your operating system starts.
          </p>
          <div className="flex flex-col space-y-4 bg-card p-6 rounded-xl border border-border shadow-sm max-w-2xl">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-base font-semibold">Start with System</h4>
                <p className="text-sm text-muted-foreground">Automatically launch the application on startup.</p>
              </div>
              <Switch checked={startWithWindows} onCheckedChange={setStartWithWindows} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-base font-semibold">Hide on Startup</h4>
                <p className="text-sm text-muted-foreground">Keep the window hidden to the system tray when auto-starting.</p>
              </div>
              <Switch checked={hideOnStartup} onCheckedChange={setHideOnStartup} disabled={!startWithWindows} />
            </div>
          </div>
        </section>
        
        {/* Storage Configuration */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-border/50 pb-2 mb-4">
             <HardDrive className="h-5 w-5 text-primary" />
             <h3 className="text-lg font-semibold tracking-tight">Storage & Library</h3>
          </div>
          <p className="text-sm text-muted-foreground mr-10 leading-relaxed max-w-2xl">
            Modifying this changes the default target for FUTURE downloads. Existing active downloads will continue correctly in their initialized locations unless canceled.
          </p>
          <div className="flex items-center space-x-3 bg-card p-4 rounded-xl border border-border shadow-sm max-w-2xl">
            <FolderOpen className="w-8 h-8 opacity-20 mr-2 shrink-0" />
            <div className="flex-1 w-full truncate">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Primary Library Path</span>
                <Input disabled value={displayPath || ""} className="bg-transparent border-0 opacity-100 placeholder:text-muted-foreground font-mono text-sm focus-visible:ring-0 p-0 h-auto shadow-none truncate" />
            </div>
            <Button variant="outline" className="shrink-0 group relative overflow-hidden" onClick={openFolder}>
                <span className="relative z-10 transition-colors">Change Path</span>
            </Button>
          </div>
          
          <div className="mt-6 border-t border-border/50 pt-4 max-w-2xl space-y-4">
            <div className="space-y-1.5 w-full sm:w-1/2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Download Speed Limit (KB/s)</label>
              <Input 
                type="number" 
                value={downloadSpeedLimit || ""} 
                onChange={(e) => setDownloadSpeedLimit(Number(e.target.value) || 0)} 
                placeholder="0 (Unlimited)" 
                className="bg-background shadow-xs w-full transition-all focus-within:ring-primary/50" 
              />
              <p className="text-xs text-muted-foreground pl-1 pt-1">Set to 0 for unlimited bandwidth.</p>
            </div>
          </div>
        </section>

        {/* External Configs */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center space-x-2 border-b border-border/50 pb-2 mb-4">
             <Network className="h-5 w-5 text-primary" />
             <h3 className="text-lg font-semibold tracking-tight">External Adapters Fallback</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            If the native Rust engines fail or encounter firewall warnings, Download Manager attempts to fallback to external clients like your local qBittorrent WebUI. Set your WebUI bridge credentials here.
          </p>
          <div className="grid gap-5 bg-card/50 p-6 rounded-xl border border-border/60 max-w-3xl shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
              <div className="space-y-1.5 w-full">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">WebUI Bridge URL</label>
                <Input value={localUrl} onChange={(e) => setLocalUrl(e.target.value)} placeholder="http://127.0.0.1:8080" className="bg-background shadow-xs w-full transition-all focus-within:ring-primary/50" />
              </div>
              <div className="space-y-1.5 w-full">
                 <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">WebUI Username</label>
                <Input value={localUser} onChange={(e) => setLocalUser(e.target.value)} placeholder="admin" className="bg-background shadow-xs w-full transition-all focus-within:ring-primary/50" />
              </div>
            </div>
            <div className="space-y-1.5 w-full sm:w-[calc(50%-0.6rem)]">
               <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">WebUI Password</label>
              <Input type="password" value={localPass} onChange={(e) => setLocalPass(e.target.value)} placeholder="adminadmin" className="bg-background shadow-xs w-full transition-all focus-within:ring-primary/50" />
            </div>
            
            <div className="flex items-center space-x-4 mt-4 pt-2 border-t border-border/50">
              <Button onClick={handleSaveNetwork} className="px-6 font-semibold shadow-sm transition-all hover:scale-[1.02]">Save Settings</Button>
              <Button onClick={handleReset} variant="secondary" className="font-medium text-muted-foreground hover:text-foreground">
                  <RotateCcw className="h-4 w-4 mr-2" /> Reset 
              </Button>
            </div>
          </div>
        </section>
        
      </div>
    </>
  );
}
