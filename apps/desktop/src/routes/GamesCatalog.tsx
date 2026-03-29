import { Search, LayoutGrid, List, Sun, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useGamesStore } from "@/store/useGamesStore";
import { useDownloadStore } from "@/stores/downloadStore";
import { decodeHtml } from "@/lib/utils";
import { CachedImage } from "@/components/ui/cached-image";

export default function GamesCatalog({ filter }: { filter?: "favorites" | "recent" }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const { games, favorites } = useGamesStore();
  const { tasks } = useDownloadStore();

  const filteredGames = useMemo(() => {
    let list = games;
    if (filter === "favorites") {
      list = list.filter(g => favorites.includes(g.slug));
    } else if (filter === "recent") {
      list = list.slice(0, 100);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(g => decodeHtml(g.title).toLowerCase().includes(q));
    }
    return list.slice(0, 100); // Limit to 100 for dev performance
  }, [games, favorites, searchQuery, filter]);

  return (
    <>
      <header
        data-tauri-drag-region
        className="flex h-16 shrink-0 items-center justify-between px-8 border-b border-border bg-background/95 backdrop-blur z-50 sticky top-0 transition-[padding] duration-200"
      >
        <div className="flex items-center space-x-4">
          <SidebarTrigger />
          <h2 className="text-lg font-semibold capitalize tracking-tight shrink-0">
            {filter === "favorites" ? "Favorites" : filter === "recent" ? "Recently Updated" : "Games Catalog"}
          </h2>
        </div>

        <div className="flex items-center space-x-3 w-full max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={`Search ${games.length} repacks...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 bg-muted/50 border-none focus-visible:ring-1"
            />
          </div>
          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <div className="flex bg-muted rounded-md p-1">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className={`h-7 w-7 rounded-sm ${viewMode === "grid" ? "shadow-sm" : "opacity-50"}`}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className={`h-7 w-7 rounded-sm ${viewMode === "list" ? "shadow-sm" : "opacity-50"}`}
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            {/* Theme Toggle Button */}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-white/10 shrink-0 shadow-sm"
              onClick={() => {
                const isDark = document.documentElement.classList.contains('dark');
                document.documentElement.classList.toggle('dark', !isDark);
                localStorage.setItem('theme', isDark ? 'light' : 'dark');
              }}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="p-8">
        <div className="grid gap-6">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredGames.map((game, i) => (
                <Link to={`/games/view/${game.slug}`} key={i} className="group relative aspect-[3/4] rounded-xl bg-muted/30 border border-border/50 overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 cursor-pointer flex flex-col">
                  {game.postImage ? (
                    <CachedImage src={game.postImage} alt={decodeHtml(game.title)} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center">No Image</div>
                  )}
                  {tasks.find(t => t.gameSlug === game.slug) && (
                    <div className="absolute top-3 right-3 bg-background/80 backdrop-blur rounded-full p-0.5 z-30 flex items-center justify-center border border-primary/20 shadow-sm">
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <svg className="w-8 h-8 -rotate-90">
                          <circle className="text-muted/30" strokeWidth="2.5" stroke="currentColor" fill="transparent" r="14" cx="16" cy="16" />
                          <circle className="text-primary transition-all duration-500" strokeWidth="2.5" strokeLinecap="round" stroke="currentColor" fill="transparent" r="14" cx="16" cy="16" strokeDasharray={`${(tasks.find(t => t.gameSlug === game.slug)?.progress || 0) * 87.96} 87.96`} />
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent z-10" />
                  <div className="absolute bottom-4 left-4 right-4 z-20">
                    <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1 shadow-background uppercase tracking-tight">{decodeHtml(game.title)}</h3>
                    <p className="text-xs text-muted-foreground bg-background/50 backdrop-blur w-fit px-1.5 py-0.5 rounded">
                      {new Date(game.date).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              {filteredGames.map((game, i) => (
                <Link to={`/games/view/${game.slug}`} key={i} className="flex items-center space-x-4 p-3 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group">
                  <div className="w-20 h-10 bg-muted/50 rounded overflow-hidden shrink-0 object-cover relative">
                    {game.postImage && <CachedImage src={game.postImage} alt={decodeHtml(game.title)} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{decodeHtml(game.title)}</h3>
                  </div>
                  {tasks.find(t => t.gameSlug === game.slug) && (
                    <div className="w-24 shrink-0 mx-2 h-1.5 bg-muted/50 rounded-full overflow-hidden self-center border border-border/50">
                       <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(tasks.find(t => t.gameSlug === game.slug)?.progress || 0) * 100}%` }} />
                    </div>
                  )}
                  <div className="flex items-center space-x-4 shrink-0 pr-4 text-xs text-muted-foreground w-28 text-right">
                    <span>{new Date(game.date).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
