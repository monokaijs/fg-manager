import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSettingsStore } from "@/stores/settingsStore";
import { useEffect, useState } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { HardDrive, Network, RotateCcw } from "lucide-react";

export default function SettingsView() {
  const { qbUrl, qbUsername, qbPassword, setQbConfig } = useSettingsStore();

  const [downloadPath, setDownloadPath] = useState("Loading...");
  
  const [localUrl, setLocalUrl] = useState(qbUrl);
  const [localUser, setLocalUser] = useState(qbUsername);
  const [localPass, setLocalPass] = useState(qbPassword);

  useEffect(() => {
    appDataDir().then(dir => {
      join(dir, "downloads").then(path => setDownloadPath(path));
    }).catch(e => {
      setDownloadPath("Failed to resolve path");
    });
  }, []);

  const handleSaveNetwork = () => {
    setQbConfig(localUrl, localUser, localPass);
    toast.success("Network settings saved!");
  };

  const handleReset = () => {
    setLocalUrl('http://127.0.0.1:8080');
    setLocalUser('');
    setLocalPass('');
    setQbConfig('http://127.0.0.1:8080', '', '');
    toast.info("Network settings reset back to defaults.");
  };

  return (
    <>
      <header
        data-tauri-drag-region
        className="flex h-16 shrink-0 items-center px-8 border-b border-border bg-background/95 backdrop-blur z-50 sticky top-0 transition-[padding] duration-200"
      >
        <SidebarTrigger className="mr-4" />
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
      </header>
      <div className="p-8 max-w-2xl space-y-10">
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-border/50 pb-2 mb-4">
             <HardDrive className="h-5 w-5 text-primary" />
             <h3 className="text-lg font-medium tracking-tight">Installation Path</h3>
          </div>
          <p className="text-sm text-muted-foreground mr-10 leading-relaxed">
            Local games downloaded natively via the embedded Rust client will be installed here.
            Modifying this natively requires rebuilding the embedded session. For now, it respects your OS's AppData directive.
          </p>
          <div className="flex space-x-3 bg-muted/30 p-1 rounded-lg border border-border/50 shadow-sm">
            <Input disabled value={downloadPath} className="bg-transparent border-0 opacity-100 placeholder:text-muted-foreground font-mono text-xs focus-visible:ring-0" />
            <Button variant="outline" size="sm" className="shrink-0 mr-1 mt-1 opacity-50 cursor-not-allowed" onClick={() => toast.info("Directory changing is locked for embedded beta.")}>Locked</Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-border/50 pb-2 mb-4">
             <Network className="h-5 w-5 text-primary" />
             <h3 className="text-lg font-medium tracking-tight">External Adapters (qBittorrent)</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If the native Rust client fails, we fallback to the local qBittorrent WebUI if running. Set your WebUI credentials here.
          </p>
          <div className="grid gap-4 bg-muted/10 p-5 rounded-xl border border-border/40">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">WebUI URL</label>
                <Input value={localUrl} onChange={(e) => setLocalUrl(e.target.value)} placeholder="http://127.0.0.1:8080" className="bg-background shadow-sm" />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</label>
                <Input value={localUser} onChange={(e) => setLocalUser(e.target.value)} placeholder="admin" className="bg-background shadow-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
               <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
              <Input type="password" value={localPass} onChange={(e) => setLocalPass(e.target.value)} placeholder="adminadmin" className="bg-background shadow-sm md:w-[calc(50%-0.5rem)]" />
            </div>
            
            <div className="flex items-center space-x-3 mt-2">
              <Button onClick={handleSaveNetwork} className="px-8 shadow-md">Save Settings</Button>
              <Button onClick={handleReset} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground"><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
