import { Search, LayoutGrid, List, Sun, Moon } from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useGamesStore } from "@/store/useGamesStore";
import { decodeHtml } from "@/lib/utils";
import { GameCard } from "@/components/game-card";

export default function GamesCatalog({ filter }: { filter?: "favorites" | "recent" }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const { games, favorites } = useGamesStore();

  // Create a memoized lookup table of decoded lowercased titles for ultra-fast filtering
  const decodedTitles = useMemo(() => {
    const map = new Map<string, string>();
    games.forEach(g => {
      map.set(g.slug, decodeHtml(g.title).toLowerCase());
    });
    return map;
  }, [games]);

  const filteredGames = useMemo(() => {
    let list = games;
    if (filter === "favorites") {
      list = list.filter(g => favorites.includes(g.slug));
    } else if (filter === "recent") {
      list = list.slice(0, 100);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(g => {
        const title = decodedTitles.get(g.slug);
        return title ? title.includes(q) : false;
      });
    }
    return list.slice(0, 100); // Limit to 100 for dev performance
  }, [games, favorites, searchQuery, filter, decodedTitles]);

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
                <GameCard key={i} game={game} viewMode="grid" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              {filteredGames.map((game, i) => (
                <GameCard key={i} game={game} viewMode="list" />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
