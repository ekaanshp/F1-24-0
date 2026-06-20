'use client';

// =============================================================================
// LeaderboardClient — Interactive Leaderboard Display
// =============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import type { LeaderboardRow } from '@/types';

interface LeaderboardClientProps {
  allScores: LeaderboardRow[];
  regularScores: LeaderboardRow[];
  hardcoreScores: LeaderboardRow[];
}

type Tab = 'all' | 'regular' | 'hardcore';

const SLOT_LABELS: Record<string, string> = {
  driver1: '🏎️ Driver 1',
  driver2: '🏎️ Driver 2',
  chassis: '🔧 Chassis',
  engine: '⚡ Engine',
  teamPrincipal: '👔 Team Principal',
  carDesigner: '📐 Car Designer',
  leadEngineer1: '🛠️ Engineer 1',
  leadEngineer2: '🛠️ Engineer 2',
};

export default function LeaderboardClient({
  allScores,
  regularScores,
  hardcoreScores,
}: LeaderboardClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const scores = activeTab === 'all' ? allScores
    : activeTab === 'regular' ? regularScores
    : hardcoreScores;

  const toggleExpand = (playerName: string) => {
    setExpandedRow((prev) => (prev === playerName ? null : playerName));
  };

  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-heading text-3xl md:text-4xl font-black mb-2">
          <span style={{ color: 'var(--accent-amber)' }}>🏆</span>{' '}
          <span style={{ color: 'var(--text-primary)' }}>LEADERBOARD</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Top team builders from around the world
        </p>
      </motion.div>

      {/* Tab filters */}
      <div className="flex justify-center gap-2 mb-6">
        {(['all', 'regular', 'hardcore'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setExpandedRow(null); }}
            className="px-5 py-2 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all"
            style={activeTab === tab ? {
              background: tab === 'hardcore' ? 'var(--f1-red)' : 'var(--accent-blue)',
              color: 'var(--f1-dark)',
            } : {
              background: 'var(--surface)',
              color: 'var(--text-muted)',
            }}
            id={`tab-${tab}-btn`}
          >
            {tab === 'all' ? 'All' : tab === 'regular' ? '📊 Regular' : '🔥 Hardcore'}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="overlay-panel overflow-hidden"
      >
        {/* Table header */}
        <div className="leaderboard-row text-xs font-heading uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">Score</span>
          <span className="text-center">Decade</span>
          <span className="text-center">Mode</span>
        </div>

        {/* Rows */}
        {scores.length === 0 && (
          <div className="text-center py-16">
            <p className="text-lg mb-2">🏁</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No scores yet. Be the first to play!
            </p>
            <Link href="/" className="btn-primary inline-block mt-4 text-sm">
              Start Draft
            </Link>
          </div>
        )}

        <AnimatePresence>
          {scores.map((entry) => (
            <motion.div
              key={entry.playerName}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              layout
            >
              <button
                onClick={() => toggleExpand(entry.playerName)}
                className="leaderboard-row w-full text-left hover:bg-white/5 transition-colors"
              >
                {/* Rank badge */}
                <div>
                  <span className={`rank-badge ${
                    entry.rank === 1 ? 'rank-1' :
                    entry.rank === 2 ? 'rank-2' :
                    entry.rank === 3 ? 'rank-3' : ''
                  }`} style={entry.rank > 3 ? {
                    background: 'var(--surface)',
                    color: 'var(--text-muted)',
                  } : {}}>
                    {entry.rank}
                  </span>
                </div>

                {/* Player name */}
                <span className="font-heading text-sm font-bold tracking-wide"
                  style={{ color: 'var(--text-primary)' }}>
                  {entry.playerName}
                </span>

                {/* Score */}
                <span className="font-heading text-sm font-bold text-right"
                  style={{ color: 'var(--accent-blue)' }}>
                  {entry.totalPoints.toFixed(1)}
                </span>

                {/* Decade */}
                <span className="text-xs text-center"
                  style={{ color: 'var(--text-secondary)' }}>
                  {entry.decade}
                </span>

                {/* Mode */}
                <span className="text-xs text-center"
                  style={entry.gameMode === 'hardcore'
                    ? { color: 'var(--f1-red)' }
                    : { color: 'var(--text-muted)' }}>
                  {entry.gameMode === 'hardcore' ? '🔥' : '📊'}
                </span>
              </button>

              {/* Expanded roster detail */}
              <AnimatePresence>
                {expandedRow === entry.playerName && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-2"
                      style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                      {Object.entries(SLOT_LABELS).map(([key, label]) => {
                        const value = entry[key as keyof LeaderboardRow];
                        return (
                          <div key={key} className="px-3 py-2 rounded-lg"
                            style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                            <span className="text-[10px] uppercase tracking-wider block mb-0.5"
                              style={{ color: 'var(--text-muted)' }}>
                              {label}
                            </span>
                            <span className="text-xs font-medium"
                              style={{ color: 'var(--text-primary)' }}>
                              {typeof value === 'string' ? value : '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Footer links */}
      <div className="text-center mt-8">
        <Link href="/" className="text-xs hover:underline"
          style={{ color: 'var(--text-muted)' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
