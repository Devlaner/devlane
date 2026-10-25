/* eslint-disable react-refresh/only-export-components -- context file exports FavoritesProvider + useFavorites; keep for future use */
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { FavoriteApiResponse } from '../api/types';

interface FavoritesContextValue {
  favoriteProjectIds: string[];
  setFavoriteProjectIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  /** The workspace favorites tree (cycles/modules + folders), shared so the
   * sidebar and pages stay in sync. */
  workspaceFavorites: FavoriteApiResponse[];
  setWorkspaceFavorites: (
    favs: FavoriteApiResponse[] | ((prev: FavoriteApiResponse[]) => FavoriteApiResponse[]),
  ) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>([]);
  const [workspaceFavorites, setWorkspaceFavorites] = useState<FavoriteApiResponse[]>([]);
  return (
    <FavoritesContext.Provider
      value={{
        favoriteProjectIds,
        setFavoriteProjectIds,
        workspaceFavorites,
        setWorkspaceFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
