import { HardDrive } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDownloadStore } from "@/stores/downloadStore";
import { useGamesStore } from "@/store/useGamesStore";
import { useMemo } from "react";
import { GameCard } from "@/components/game-card";

export default function LibraryView() {
  // Only subscribe to task slugs so it doesn't re-render on progress ticks!
  const taskSlugs = useDownloadStore(state => 
    state.tasks.map(t => t.gameSlug).filter(Boolean).sort().join(',')
  );
  const { games } = useGamesStore();

  const libraryGames = useMemo(() => {
    // Only games that are currently downloading or finished
    const slugsSet = new Set(taskSlugs.split(',').filter(Boolean));
    return games.filter(g => slugsSet.has(g.slug));
  }, [taskSlugs, games]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header
        className="flex h-16 shrink-0 items-center px-8 border-b border-border bg-background z-50 relative"
      >
        <SidebarTrigger className="mr-4" />
        <h2 className="text-lg font-semibold tracking-tight">My Library</h2>
      </header>
      
      <div className="flex-1 overflow-y-auto w-full" style={{ willChange: 'scroll-position', transform: 'translateZ(0)', scrollBehavior: 'smooth' }}>
        {libraryGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-2">
              <HardDrive className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium tracking-tight">Your Library is empty</h3>
            <p className="text-muted-foreground max-w-sm">
              Games you've installed locally or are currently downloading will automatically appear here for quick access.
            </p>
          </div>
        ) : (
          <div className="p-8">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {libraryGames.map((game, i) => (
                <GameCard key={i} game={game} viewMode="grid" showStatus={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
