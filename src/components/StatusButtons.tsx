'use client';

import { useState } from 'react';

export type GameStatusType = 'played' | 'liked' | 'not_interested';

interface StatusButtonsProps {
  appid: number;
  name: string;
  currentStatus?: GameStatusType | null;
  onStatusChange?: (appid: number, status: GameStatusType | null) => void;
  compact?: boolean;
}

const STATUS_CONFIG: Record<GameStatusType, { emoji: string; label: string; activeClass: string }> = {
  played: {
    emoji: '✅',
    label: 'Played',
    activeClass: 'bg-green-500/20 text-green-400 border-green-500/50',
  },
  liked: {
    emoji: '❤️',
    label: 'Liked',
    activeClass: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
  },
  not_interested: {
    emoji: '🚫',
    label: 'Not Interested',
    activeClass: 'bg-red-500/20 text-red-400 border-red-500/50',
  },
};

export default function StatusButtons({
  appid,
  name,
  currentStatus,
  onStatusChange,
  compact = false,
}: StatusButtonsProps) {
  const [status, setStatus] = useState<GameStatusType | null>(currentStatus || null);
  const [saving, setSaving] = useState(false);

  async function toggleStatus(newStatus: GameStatusType) {
    if (saving) return;
    setSaving(true);

    try {
      if (status === newStatus) {
        // Remove status
        await fetch(`/api/game-status?appid=${appid}`, { method: 'DELETE' });
        setStatus(null);
        onStatusChange?.(appid, null);
      } else {
        // Set status
        await fetch('/api/game-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appid, name, status: newStatus }),
        });
        setStatus(newStatus);
        onStatusChange?.(appid, newStatus);
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`flex ${compact ? 'gap-1' : 'gap-2'}`}>
      {(Object.entries(STATUS_CONFIG) as [GameStatusType, typeof STATUS_CONFIG[GameStatusType]][]).map(
        ([key, config]) => {
          const isActive = status === key;
          return (
            <button
              key={key}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleStatus(key);
              }}
              disabled={saving}
              title={isActive ? `Remove "${config.label}"` : config.label}
              className={`
                ${compact ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2.5 py-1'}
                rounded-full border transition-all duration-200 font-medium
                disabled:opacity-50
                ${isActive
                  ? config.activeClass
                  : 'border-[#2a3f5f]/50 text-steam-text-secondary hover:border-[#2a3f5f] hover:text-white'
                }
              `}
            >
              {config.emoji}{!compact && ` ${config.label}`}
            </button>
          );
        }
      )}
    </div>
  );
}

/** Small badge to show on game cards */
export function StatusBadge({ status }: { status: GameStatusType }) {
  const badges: Record<GameStatusType, { emoji: string; bg: string }> = {
    played: { emoji: '✅', bg: 'bg-green-500/80' },
    liked: { emoji: '❤️', bg: 'bg-pink-500/80' },
    not_interested: { emoji: '🚫', bg: 'bg-red-500/80' },
  };

  const badge = badges[status];
  return (
    <span className={`${badge.bg} backdrop-blur-sm text-white text-xs w-6 h-6 rounded-full flex items-center justify-center`}>
      {badge.emoji}
    </span>
  );
}
