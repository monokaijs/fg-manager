import { Link } from "react-router-dom";
import { decodeHtml } from "@/lib/utils";
import { useDownloadStore } from "@/stores/downloadStore";
import React, { useMemo } from 'react';
import { type GameBrief } from "@/store/useGamesStore";

interface GameCardProps {
  game: GameBrief;
  viewMode?: "grid" | "list";
  showStatus?: boolean;
}

export const GameCard = React.memo(function GameCard({ game, viewMode = "grid", showStatus = false }: GameCardProps) {
  // Only subscribe to this specific game's task to prevent massive 100-card re-renders on ANY progress tick
  const task = useDownloadStore(state => state.tasks.find((t) => t.gameSlug === game.slug));
  const decodedTitle = useMemo(() => decodeHtml(game.title), [game.title]);

  if (viewMode === "list") {
    return (
      <Link to={`/games/view/${game.slug}`} className="flex items-center space-x-4 p-3 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-border transition-colors cursor-pointer group">
        <div className="w-20 h-10 bg-muted/50 rounded overflow-hidden shrink-0 object-cover relative">
          {game.postImage && <img loading="lazy" decoding="async" src={game.postImage} alt={decodedTitle} className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate">{decodedTitle}</h3>
        </div>
        {task && (
          <div className="w-24 shrink-0 mx-2 h-1.5 bg-muted/50 rounded-full overflow-hidden self-center border border-border/50">
             <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(task.progress || 0) * 100}%` }} />
          </div>
        )}
        <div className="flex items-center space-x-4 shrink-0 pr-4 text-xs text-muted-foreground w-28 text-right">
          <span className="capitalize">{showStatus && task ? task.status : showStatus ? "Installed" : new Date(game.date).toLocaleDateString()}</span>
        </div>
      </Link>
    );
  }

  // Grid view
  return (
    <Link to={`/games/view/${game.slug}`} className="group relative aspect-[3/4] rounded-xl bg-muted/30 border border-border/50 overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 cursor-pointer flex flex-col">
      {game.postImage ? (
        <img loading="lazy" decoding="async" src={game.postImage} alt={decodedTitle} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform transform-gpu" />
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">No Image</div>
      )}
      
      {task && (
        <div className="absolute top-3 right-3 bg-background/90 rounded-full p-0.5 z-30 flex items-center justify-center border border-primary/20 shadow-sm">
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
        <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1 shadow-background uppercase tracking-tight">{decodedTitle}</h3>
        <p className="text-xs text-muted-foreground bg-background/80 w-fit px-1.5 py-0.5 rounded capitalize">
          {showStatus && task ? task.status : showStatus ? "Installed" : new Date(game.date).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
});
