'use client';

// =============================================================================
// SlotCard — Read-only roster slot display
// =============================================================================
// Shows either an empty placeholder or a filled component. No click handlers.
// =============================================================================

import { motion } from 'framer-motion';
import type { DraftSelection, SlotMeta, GameMode } from '@/types';

interface SlotCardProps {
  meta: SlotMeta;
  selection: DraftSelection | null;
  index: number;
  gameMode?: GameMode;
}

export default function SlotCard({
  meta,
  selection,
  index,
  gameMode = 'regular',
}: SlotCardProps) {
  if (selection) {
    // --- Filled state ---
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="card-slot filled relative overflow-hidden flex flex-col justify-between p-4"
        style={{ minHeight: '160px' }}
      >
        <div className="relative z-10 w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium uppercase tracking-widest"
              style={{ color: 'var(--text-secondary)' }}>
              {meta.icon} {meta.label}
            </span>
          </div>

          <h3 className="font-heading text-sm font-bold tracking-wide line-clamp-2 mb-2"
            style={{ color: 'var(--text-primary)' }}>
            {selection.displayName || selection.componentName}
          </h3>

          {/* Era + Team badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99, 155, 210, 0.12)', color: 'var(--accent-blue)' }}>
              {selection.decade}
            </span>
            <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(218, 165, 32, 0.12)', color: 'var(--accent-amber)' }}>
              {selection.team}
            </span>
          </div>
        </div>

        {gameMode !== 'hardcore' && (
          <div className="relative z-10 w-full pt-2 mt-2 flex items-center justify-between text-[10px]"
            style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
            <span className="font-semibold" style={{ color: 'var(--accent-amber)' }}>🏆 {selection.wins}</span>
            <span className="font-semibold" style={{ color: 'var(--accent-blue)' }}>⏱️ {selection.poles}</span>
            <span className="font-semibold" style={{ color: 'var(--accent-green)' }}>📊 {selection.points}</span>
          </div>
        )}
      </motion.div>
    );
  }

  // --- Empty state (read-only placeholder) ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card-slot flex flex-col items-center justify-center min-h-[160px]"
    >
      <span className="text-2xl mb-2 opacity-40">{meta.icon}</span>
      <span className="text-xs font-medium uppercase tracking-widest"
        style={{ color: 'var(--text-muted)' }}>
        {meta.label}
      </span>
    </motion.div>
  );
}
