import { create } from 'zustand';
import { get, set } from 'idb-keyval';

export interface GameBrief {
  id: number;
  slug: string;
  title: string;
  postImage: string;
  date: string;
}

interface GamesState {
  version: string | null;
  games: GameBrief[];
  favorites: string[];
  isLoading: boolean;
  error: string | null;
  initDB: () => Promise<void>;
  toggleFavorite: (slug: string) => Promise<void>;
}

export const useGamesStore = create<GamesState>((setStore, getStore) => ({
  version: null,
  games: [],
  favorites: [],
  isLoading: true,
  error: null,
  toggleFavorite: async (slug: string) => {
    const { favorites } = getStore();
    const newFavs = favorites.includes(slug) 
      ? favorites.filter(f => f !== slug)
      : [...favorites, slug];
    await set('fg_favorites', newFavs);
    setStore({ favorites: newFavs });
  },
  initDB: async () => {
    try {
      setStore({ isLoading: true, error: null });
      const [localVersion, localGames, localFavorites] = await Promise.all([
        get('fg_catalog_version'),
        get('fg_catalog_games'),
        get('fg_favorites')
      ]);
      if (localFavorites) setStore({ favorites: localFavorites });

      // Check remote version
      const versionRes = await fetch('https://games-cdn.xomnghien.com/version.json');
      if (!versionRes.ok) throw new Error("Failed to fetch version.json");
      const remoteConfig = await versionRes.json();
      
      if (localVersion === remoteConfig.version && localGames && Array.isArray(localGames) && localGames.length > 0) {
        setStore({ version: localVersion, games: localGames, isLoading: false });
        // Background sync to be strictly safe? Nah, exact versioning means it is current.
        return;
      }

      // Fetch new catalog
      const catalogRes = await fetch('https://games-cdn.xomnghien.com/catalog.json');
      if (!catalogRes.ok) throw new Error("Failed to fetch catalog.json");
      const catalogData = await catalogRes.json();
      
      // Handle both the old raw Array format and the new structured version format seamlessly
      let finalGames = [];
      let finalVersion = catalogData.version || Date.now().toString();
      
      if (Array.isArray(catalogData)) {
         finalGames = catalogData; // Legacy unversioned raw array format
      } else if (catalogData.games && Array.isArray(catalogData.games)) {
         finalGames = catalogData.games; // New Versioned API payload format
      } else {
         throw new Error("Invalid catalog data format - Expected Array or { games: [] } object.");
      }

      await Promise.all([
        set('fg_catalog_version', finalVersion),
        set('fg_catalog_games', finalGames)
      ]);
      setStore({ version: finalVersion, games: finalGames, isLoading: false });

    } catch (err: any) {
      console.error("[GameManager] Failed to init DB:", err);
      // If offline but we have local cache, fallback to it
      const localGames = await get('fg_catalog_games');
      const localVersion = await get('fg_catalog_version');
      if (localGames && Array.isArray(localGames)) {
        setStore({ version: localVersion, games: localGames as GameBrief[], isLoading: false, error: err.message });
      } else {
        setStore({ isLoading: false, error: err.message });
      }
    }
  }
}));
