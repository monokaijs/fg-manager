import * as React from "react"
import { Search, Library, Download, Settings } from "lucide-react"
import { useLocation } from "react-router-dom"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useDownloadStore } from "@/stores/downloadStore"
import { NavMain } from "@/components/nav-main"
import { Link } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar"

// Using exact structure of sidebar-07 sample block
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const { tasks } = useDownloadStore();

  const activeDownloads = tasks.filter(t => typeof t.progress === 'number' && t.progress < 1).length;

  const data = {
    navMain: [
      { 
        title: "Games Catalog", 
        url: "/games", 
        icon: Search,
        isActive: location.pathname.startsWith("/games") || location.pathname === "/",
        items: [
          { title: "All Games", url: "/games" },
          { title: "Favorites", url: "/favorites" }
        ]
      },
      { 
        title: "My Library", 
        url: "/library", 
        icon: Library,
        isActive: location.pathname === "/library",
      },
      { 
        title: "Downloads", 
        url: "/downloads", 
        icon: Download,
        isActive: location.pathname === "/downloads",
        badge: activeDownloads > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
            {activeDownloads}
          </span>
        ) : undefined,
      },
    ],
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader 
        className="pt-3"
        data-tauri-drag-region
      >
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Custom macOS style Traffic Light Window Controls */}
            <div className="flex space-x-2 px-2 pb-4 pt-1">
              <div onClick={() => getCurrentWindow().close()} className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 transition-colors shadow-inner border border-rose-600/20 cursor-pointer flex items-center justify-center group z-50">
                 <div className="w-1.5 h-1.5 opacity-0 group-hover:opacity-100 transition-opacity"><svg viewBox="0 0 10 10"><path stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" strokeLinecap="round" d="M2 2l6 6M8 2L2 8"/></svg></div>
              </div>
              <div onClick={() => getCurrentWindow().minimize()} className="w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-600 transition-colors shadow-inner border border-amber-600/20 cursor-pointer flex items-center justify-center group z-50">
                 <div className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><div className="w-2 h-0.5 bg-black/50" /></div>
              </div>
              <div onClick={() => getCurrentWindow().toggleMaximize()} className="w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-inner border border-emerald-600/20 cursor-pointer flex items-center justify-center group z-50">
                 <div className="w-1.5 h-1.5 opacity-0 group-hover:opacity-100 transition-opacity"><svg viewBox="0 0 10 10"><path fill="rgba(0,0,0,0.5)" d="M1 1h8v8H1z"/></svg></div>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      
      <SidebarFooter>
         <SidebarMenu>
          <SidebarMenuItem>
            <Link to="/settings" className="flex items-center gap-2 w-full">
              <SidebarMenuButton tooltip="Settings" isActive={location.pathname === "/settings"}>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
