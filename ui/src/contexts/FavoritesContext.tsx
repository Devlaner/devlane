import { createContext, useContext, useState, type ReactNode } from 'react';

interface FavoritesContextValue {
  favoriteProjectIds: string[];
  setFavoriteProjectIds: (ids: string[] | ((prev: string[]) => string[])) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>([]);
  return (
    <FavoritesContext.Provider value={{ favoriteProjectIds, setFavoriteProjectIds }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
