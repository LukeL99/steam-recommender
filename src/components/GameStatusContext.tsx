'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { GameStatusType } from './StatusButtons';

interface GameStatusEntry {
  appid: number;
  name: string;
  status: GameStatusType;
  updatedAt: string;
}

interface StatusMap {
  [appid: string]: GameStatusEntry;
}

interface GameStatusContextValue {
  statuses: StatusMap;
  getStatus: (appid: number) => GameStatusType | null;
  setStatus: (appid: number, status: GameStatusType | null) => void;
  loading: boolean;
}

const GameStatusContext = createContext<GameStatusContextValue>({
  statuses: {},
  getStatus: () => null,
  setStatus: () => {},
  loading: true,
});

export function useGameStatuses() {
  return useContext(GameStatusContext);
}

export function GameStatusProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/game-status')
      .then(res => res.ok ? res.json() : { statuses: {} })
      .then(data => setStatuses(data.statuses || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getStatus = useCallback(
    (appid: number): GameStatusType | null => {
      return statuses[String(appid)]?.status || null;
    },
    [statuses]
  );

  const handleSetStatus = useCallback(
    (appid: number, status: GameStatusType | null) => {
      setStatuses(prev => {
        const next = { ...prev };
        if (status === null) {
          delete next[String(appid)];
        } else {
          next[String(appid)] = {
            ...next[String(appid)],
            appid,
            status,
            updatedAt: new Date().toISOString(),
          };
        }
        return next;
      });
    },
    []
  );

  return (
    <GameStatusContext.Provider value={{ statuses, getStatus, setStatus: handleSetStatus, loading }}>
      {children}
    </GameStatusContext.Provider>
  );
}
