import { HardDrive } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDownloadStore } from "@/stores/downloadStore";
import { useGamesStore } from "@/store/useGamesStore";
import { Link } from "react-router-dom";
import { decodeHtml } from "@/lib/utils";
import { useMemo } from "react";
import { CachedImage } from "@/components/ui/cached-image";

export default function LibraryView() {
  const { tasks } = useDownloadStore();
  const { games } = useGamesStore();

  const libraryGames = useMemo(() => {
    // Only games that are currently downloading or finished
    const taskSlugs = new Set(tasks.map(t => t.gameSlug).filter(Boolean));
    return games.filter(g => taskSlugs.has(g.slug));
  }, [tasks, games]);

  return (
    <>
      <header
        data-tauri-drag-region
        className="flex h-16 shrink-0 items-center px-8 border-b border-border bg-background/95 backdrop-blur z-50 sticky top-0 transition-[padding] duration-200"
      >
        <SidebarTrigger className="mr-4" />
        <h2 className="text-lg font-semibold tracking-tight">My Library</h2>
      </header>
      
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
            {libraryGames.map((game, i) => {
              const task = tasks.find(t => t.gameSlug === game.slug);
              return (
                <Link to={`/games/view/${game.slug}`} key={i} className="group relative aspect-[3/4] rounded-xl bg-muted/30 border border-border/50 overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 cursor-pointer flex flex-col">
                  {game.postImage ? (
                    <CachedImage src={game.postImage} alt={decodeHtml(game.title)} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center">No Image</div>
                  )}
                  
                  {task && (
                    <div className="absolute top-3 right-3 bg-background/80 backdrop-blur rounded-full p-0.5 z-30 flex items-center justify-center border border-primary/20 shadow-sm">
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <svg className="w-8 h-8 -rotate-90">
                          <circle className="text-muted/30" strokeWidth="2.5" stroke="currentColor" fill="transparent" r="14" cx="16" cy="16" />
                          <circle className="text-primary transition-all duration-500" strokeWidth="2.5" strokeLinecap="round" stroke="currentColor" fill="transparent" r="14" cx="16" cy="16" strokeDasharray={`${task.progress * 87.96} 87.96`} />
                        </svg>
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent z-10" />
                  <div className="absolute bottom-4 left-4 right-4 z-20">
                    <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1 shadow-background uppercase tracking-tight">{decodeHtml(game.title)}</h3>
                    <p className="text-xs text-muted-foreground bg-background/50 backdrop-blur w-fit px-1.5 py-0.5 rounded capitalize">
                      {task ? task.status : "Installed"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
