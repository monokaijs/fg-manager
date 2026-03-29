import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertCircle, ArrowLeft, Download, HardDrive, Star, Magnet, Copy, ChevronDown, FileArchive, Play, Pause, Trash, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGamesStore } from "@/store/useGamesStore";
import { useDownloadStore } from "@/stores/downloadStore";
import { Progress } from "@/components/ui/progress";
import { decodeHtml } from "@/lib/utils";
import { CachedImage } from "@/components/ui/cached-image";

export default function GameDetailView() {
  const { slug } = useParams();
  const { favorites, toggleFavorite } = useGamesStore();
  const { tasks, pause, resume, remove, addMagnet, addTorrent, addFastUrls } = useDownloadStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null);
  const [processingDownload, setProcessingDownload] = useState<boolean>(false);

  useEffect(() => {
    fetch(`https://games-cdn.xomnghien.com/posts/${slug}.json`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [slug]);

  if (loading) return (
    <div className="p-8 flex flex-col items-center justify-center h-full">
      <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
      <p className="text-muted-foreground">Loading Game Metadata...</p>
    </div>
  );

  if (!data) return (
    <div className="p-8 text-center text-muted-foreground mt-12">
      <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <h2>Game not found</h2>
    </div>
  );

  const heroImage = data.postImage || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop";
  const currentMedia = selectedMediaUrl || data?.screenshotImages?.[0];
  const activeTask = tasks.find(t => t.gameSlug === slug);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="relative min-h-[120vh] pb-[25vh]">
      {/* Absolute Header Gradient */}
      <div className="absolute inset-x-0 top-0 h-96 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background z-10" />
        <CachedImage src={heroImage} className="w-full h-full object-cover opacity-30 blur-sm scale-105" alt="Blur bg" />
      </div>

      <div className="relative z-10 block">
        <header
          data-tauri-drag-region
          className="flex h-16 items-center px-8 border-b border-border bg-background/50 sticky top-0 transition-[padding] duration-200 backdrop-blur-md z-50"
        >
          <Link to="/games" className="mr-4 text-muted-foreground hover:text-foreground transition-colors flex items-center z-10">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back to Catalog
          </Link>
        </header>

        <div className="max-w-6xl mx-auto px-8 pt-12 text-shadow-sm">
          {/* Main Hero Header - Steam Style */}
          <div className="mb-6 pb-2">
            <h1 className="text-3xl md:text-4xl font-black tracking-wider leading-none">
              <span className="text-foreground drop-shadow-sm">
                {decodeHtml(data.title)}
              </span>
            </h1>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            {/* Left Media Column */}
            <div className="w-full lg:w-2/3 flex flex-col gap-2">
              <div className="w-full rounded bg-black relative aspect-video shadow-md overflow-hidden">
                {currentMedia ? (
                  <CachedImage src={currentMedia} alt={decodeHtml(data.title)} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">No Media</div>
                )}
              </div>

              {/* Thumbnails */}
              {data.screenshotImages && data.screenshotImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pt-1 pb-2 px-1 -mx-1 custom-scrollbar">
                  {data.screenshotImages.map((src: string, i: number) => (
                    <div
                      key={i}
                      onClick={() => setSelectedMediaUrl(src)}
                      className={`shrink-0 h-[68px] aspect-video overflow-hidden cursor-pointer transition-all rounded ${currentMedia === src ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
                    >
                      <CachedImage src={src} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Meta Column */}
            <div className="w-full lg:w-1/3 flex flex-col">
              <div className="w-full rounded overflow-hidden shadow-sm mb-3">
                {data.postImage ? (
                  <CachedImage src={data.postImage} alt="Cover" className="w-full h-full aspect-[4/3] object-cover object-top bg-muted/20" />
                ) : null}
              </div>

              <div className="text-[13px] text-muted-foreground leading-relaxed line-clamp-[7] mb-3 pr-2">
                {Array.isArray(data.features) ? data.features.slice(0, 6).map((f: string) => decodeHtml(f)).join(" • ") : "No description available."}
              </div>

              <div className="grid grid-cols-[115px_1fr] gap-x-2 gap-y-1 mb-4 text-[13px] font-medium mt-auto">
                <span className="text-muted-foreground/60 w-full truncate">RELEASE DATE:</span>
                <span className="text-foreground/80 truncate">{new Date(data.date).toLocaleDateString()}</span>

                {Array.isArray(data.features) && data.features.find((f: string) => f.toLowerCase().includes('original size')) && (
                  <>
                    <span className="text-muted-foreground/60 w-full truncate">ORIGINAL SIZE:</span>
                    <span className="text-foreground/80 truncate">{data.features.find((f: string) => f.toLowerCase().includes('original size'))?.replace(/original size:?/i, '').trim()}</span>
                  </>
                )}
                {Array.isArray(data.features) && data.features.find((f: string) => f.toLowerCase().includes('repack size')) && (
                  <>
                    <span className="text-muted-foreground/60 w-full truncate">REPACK SIZE:</span>
                    <span className="text-foreground/80 truncate">{data.features.find((f: string) => f.toLowerCase().includes('repack size'))?.replace(/repack size:?/i, '').trim()}</span>
                  </>
                )}
                {Array.isArray(data.features) && data.features.find((f: string) => f.toLowerCase().includes('company')) && (
                  <>
                    <span className="text-muted-foreground/60 w-full truncate">DEVELOPER:</span>
                    <span className="text-primary hover:text-primary/80 cursor-pointer truncate">{data.features.find((f: string) => f.toLowerCase().includes('company'))?.replace(/company:?/i, '').trim()}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Steam-Style Action Bar */}
          <div className="bg-card w-full mb-8 rounded px-6 py-5 flex flex-col md:flex-row items-center justify-end shadow-sm border border-border">
            <div className="flex items-center gap-3">
              {(() => {
                const magnetLink = data.torrentLinks?.find((t: any) => t.type === 'magnet' || t.url?.startsWith('magnet:'))?.url;
                const torrentFile = data.torrentLinks?.find((t: any) => t.type?.toLowerCase().includes('torrent') && !t.type?.toLowerCase().includes('magnet'))?.url;
                const fuckingFastMirror = data.downloadCollections?.find((col: any) => col.host.toLowerCase().replace(/\s/g, '').includes('fuckingfast'));

                const hasOptions = magnetLink || torrentFile || fuckingFastMirror;

                return hasOptions ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger disabled={processingDownload} className="inline-flex items-center justify-center whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-5 h-auto cursor-pointer">
                      {processingDownload ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" /> Download <ChevronDown className="w-4 h-4 ml-2 opacity-50" /></>
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 border-border shadow-xl">
                      {magnetLink && (
                        <DropdownMenuItem 
                          onClick={async () => {
                            setProcessingDownload(true);
                            const success = await addMagnet(magnetLink, slug);
                            setProcessingDownload(false);
                            if (success) {
                              toast.success("Download started!");
                            } else {
                              toast.error("Failed to start download. Please check your config.");
                            }
                          }} 
                          className="cursor-pointer py-3 px-4 font-medium"
                        >
                          <Magnet className="w-4 h-4 mr-3 opacity-70" /> Torrent Magnet
                        </DropdownMenuItem>
                      )}
                      {torrentFile && (
                         <DropdownMenuItem 
                          onClick={async () => {
                            setProcessingDownload(true);
                            const success = await addTorrent(torrentFile, slug);
                            setProcessingDownload(false);
                            if (success) {
                              toast.success("Download started!");
                            } else {
                              toast.error("Failed to start download. Please check your config.");
                            }
                          }} 
                          className="cursor-pointer py-3 px-4 font-medium"
                        >
                          <FileArchive className="w-4 h-4 mr-3 opacity-70" /> Torrent File
                        </DropdownMenuItem>
                      )}
                      {fuckingFastMirror && (
                        <DropdownMenuItem 
                          onClick={async () => {
                            if (slug) {
                              setProcessingDownload(true);
                              const success = await addFastUrls(slug, slug, fuckingFastMirror.urls);
                              setProcessingDownload(false);
                              if (success) {
                                toast.success("Download started!");
                              } else {
                                toast.error("Failed to start download. Please check your config.");
                              }
                            }
                          }} 
                          className="cursor-pointer py-3 px-4 font-medium flex items-center justify-between"
                        >
                          <div className="flex items-center"><HardDrive className="w-4 h-4 mr-3 opacity-70" /> Fucking Fast</div>
                          {fuckingFastMirror.urls.length > 1 && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{fuckingFastMirror.urls.length} parts</span>}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button disabled className="px-6 py-5 h-auto font-bold opacity-50">Unavailable</Button>
                );
              })()}
              <Button onClick={() => slug && toggleFavorite(slug)} variant={slug && favorites.includes(slug) ? "default" : "secondary"} className="px-6 py-5 h-auto relative font-semibold">
                <Star className={`w-4 h-4 mr-2 ${slug && favorites.includes(slug) ? 'fill-current text-primary-foreground' : ''}`} /> {slug && favorites.includes(slug) ? "Wishlisted" : "Add to Wishlist"}
              </Button>
            </div>
          </div>

          {/* Active Download Embedded Progress */}
          {activeTask && (
            <div className={`w-full mb-8 rounded-xl p-5 border shadow-sm ${activeTask.status === 'extracting' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card border-border'}`}>
              <div className="flex justify-between items-center mb-3">
                <h4 className={`text-sm font-semibold tracking-tight capitalize flex items-center gap-2 ${activeTask.status === 'extracting' ? 'text-amber-500' : activeTask.status === 'installing' ? 'text-green-500' : 'text-primary'}`}>
                   {activeTask.status === 'extracting' ? 'Extracting Archive: Do Not Turn Off' : activeTask.status === 'installing' ? 'Installing: Please complete the setup wizard' : `Downloading: ${activeTask.status}`}
                </h4>
                <span className="text-xs font-medium text-muted-foreground">{Math.round(activeTask.progress * 100)}%</span>
              </div>
              <Progress value={activeTask.progress * 100} className={`h-1.5 mb-3 ${activeTask.status === 'extracting' ? 'bg-amber-500/20 [&>div]:bg-amber-500' : activeTask.status === 'installing' ? 'bg-green-500/20 [&>div]:bg-green-500' : ''}`} />
              <div className="flex justify-between items-end">
                 <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                   <span>{formatBytes(activeTask.downloaded)} / {formatBytes(activeTask.totalSize)}</span>
                   {activeTask.status === 'downloading' && (
                     <span>{formatBytes(activeTask.downloadSpeed)}/s • ETA: {activeTask.eta > 0 ? `${Math.ceil(activeTask.eta / 60)}m` : 'Unknown'}</span>
                   )}
                 </div>
                 <div className="flex items-center gap-1">
                   {activeTask.status === 'paused' || activeTask.status === 'error' ? (
                     <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => resume(activeTask.id)}>
                       <Play className="w-3 h-3 opacity-70" />
                     </Button>
                   ) : (
                     <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => pause(activeTask.id)}>
                       <Pause className="w-3 h-3 opacity-70" />
                     </Button>
                   )}
                   <Button variant="outline" size="icon" className="h-7 w-7 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => remove(activeTask.id, true)}>
                     <Trash className="w-3 h-3" />
                   </Button>
                 </div>
              </div>
            </div>
          )}

          {/* Details Section */}
          <div className="grid md:grid-cols-3 gap-12">
            <div className="md:col-span-2 space-y-8">
              <div>
                <h3 className="text-xl font-bold uppercase tracking-wider mb-4 flex items-center"><HardDrive className="w-5 h-5 mr-2 opacity-50" /> Repack Features</h3>
                <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
                  <ul className="space-y-3 font-medium text-card-foreground/80 list-disc pl-4">
                    {Array.isArray(data.features) ? data.features.map((f: string, i: number) => (
                      <li key={i}>{decodeHtml(f)}</li>
                    )) : <li>{data.features?.toString() || 'No feature data'}</li>}
                  </ul>
                </div>
              </div>

              {data.downloadCollections && data.downloadCollections.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-wider mb-4 flex items-center"><Download className="w-5 h-5 mr-2 opacity-50" /> Direct Mirrors</h3>
                  <div className="bg-card rounded-xl p-2 border border-border shadow-sm">
                    <Accordion className="w-full">
                      {data.downloadCollections.map((col: any, j: number) => (
                        <AccordionItem value={`mirror-${j}`} key={j} className="border-border last:border-0 px-2">
                          <AccordionTrigger className="hover:no-underline hover:bg-muted/50 rounded-lg transition-colors py-3 px-3 my-1">
                            <span className="font-bold tracking-wider text-card-foreground uppercase text-sm">{col.host}</span>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-4 pt-1">
                            <div className="flex flex-col gap-1.5 mt-2">
                              {col.urls?.map((url: string, i: number) => (
                                <a key={`url-${i}`} href={url} target="_blank" className="text-primary hover:text-primary/80 hover:underline transition-colors text-[13px] font-medium truncate py-1 px-1 rounded hover:bg-muted/30">
                                  {url}
                                </a>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </div>
              )}

              {data.description && (
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-wider mb-4">About this game</h3>
                  <div className="prose dark:prose-invert max-w-none text-muted-foreground leading-relaxed font-medium bg-card p-6 rounded-xl border border-border shadow-sm" dangerouslySetInnerHTML={{ __html: data.description }} />
                </div>
              )}
            </div>

            <div className="space-y-6">
              {data.torrentLinks && data.torrentLinks.length > 0 && (
                <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Torrent Links</h4>
                  <ul className="space-y-2">
                    {data.torrentLinks.map((t: any, i: number) => (
                      <li key={i} className="flex items-center gap-2 group/link">
                        <a 
                          href={t.url} 
                          target="_blank" 
                          onClick={async (e) => {
                            if (t.type === 'magnet' || t.url?.startsWith('magnet:')) {
                              e.preventDefault();
                              const success = await addMagnet(t.url, slug);
                              if (success) toast.success("Download started!");
                              else toast.error("Failed to start download.");
                            } else if (t.type?.toLowerCase().includes('torrent') && !t.type?.toLowerCase().includes('magnet')) {
                              e.preventDefault();
                              const success = await addTorrent(t.url, slug);
                              if (success) toast.success("Download started!");
                              else toast.error("Failed to start download.");
                            }
                          }}
                          className="flex-1 text-primary hover:text-primary/80 transition-colors text-sm font-medium flex items-center capitalize truncate"
                        >
                          {t.type === 'magnet' || t.url?.startsWith('magnet:') ? (
                            <Magnet className="w-4 h-4 mr-2 opacity-50 shrink-0" />
                          ) : (
                            <Download className="w-4 h-4 mr-2 opacity-50 shrink-0" />
                          )}
                          <span className="truncate">{t.type} Link</span>
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 shrink-0 hover:bg-muted"
                          title="Copy Link"
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(t.url);
                          }}
                        >
                          <Copy className="w-4 h-4 opacity-50 hover:opacity-100" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
