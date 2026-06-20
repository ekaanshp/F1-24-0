'use client';

// =============================================================================
// DraftManager — Spin-First Draft Engine
// =============================================================================
// The user clicks SPIN to get a random era + team. Then they see all
// available components from that team and choose which one to take.
// The selected component auto-fills the correct roster slot.
// Two lifelines: respin team (same era) and respin both (new era+team).
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { DRAFT_SLOTS, SLOT_META } from '@/lib/constants';
import SlotCard from '@/components/SlotCard';
import SpinningWheel from '@/components/SpinningWheel';
import SubmitModal from '@/components/SubmitModal';
import type { ComponentOption, DraftSelection, DraftSlot, RosterState, GameMode } from '@/types';

interface LifelineState {
  respinTeam: boolean;
  respinBoth: boolean;
}

interface DraftManagerProps {
  gameMode?: GameMode;
}

export default function DraftManager({ gameMode = 'regular' }: DraftManagerProps) {
  const [roster, setRoster] = useState<RosterState>({});
  const [isSpinning, setIsSpinning] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [lifelinesUsed, setLifelinesUsed] = useState<LifelineState>({
    respinTeam: false,
    respinBoth: false,
  });

  const filledCount = useMemo(
    () => Object.keys(roster).length,
    [roster],
  );

  const isComplete = filledCount === DRAFT_SLOTS.length;

  const filledSlots = useMemo(
    () => Object.keys(roster) as DraftSlot[],
    [roster],
  );

  const excludedNames = useMemo(
    () => Object.values(roster)
      .filter((sel): sel is DraftSelection => sel !== undefined)
      .map((sel) => sel.componentName),
    [roster],
  );

  // Central spin button handler
  const handleStartSpin = useCallback(() => {
    if (isComplete || isSpinning) return;
    setIsSpinning(true);
  }, [isComplete, isSpinning]);

  // User selects a component — auto-fill the right slot
  const handleSelect = useCallback((option: ComponentOption, role: string, targetSlot: DraftSlot) => {
    const selection: DraftSelection = {
      slot: targetSlot,
      componentName: option.componentName,
      team: option.team,
      decade: option.decade,
      wins: option.wins,
      poles: option.poles,
      points: option.points,
      displayName: option.displayName,
    };

    setRoster((prev) => ({ ...prev, [targetSlot]: selection }));
    setIsSpinning(false);

    // Check if all slots filled after this selection
    const newFilledCount = Object.keys(roster).length + 1;
    if (newFilledCount >= DRAFT_SLOTS.length) {
      setTimeout(() => setShowSubmit(true), 600);
    }
  }, [roster]);

  const handleCloseSpinner = useCallback(() => {
    setIsSpinning(false);
  }, []);

  const handleUseLifeline = useCallback((type: 'respinTeam' | 'respinBoth') => {
    setLifelinesUsed((prev) => ({ ...prev, [type]: true }));
  }, []);

  return (
    <div className="min-h-screen px-4 py-8 relative">
      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h1 className="font-heading text-2xl md:text-3xl font-bold mb-2 uppercase"
            style={{ color: 'var(--text-primary)' }}>
            BUILD YOUR DREAM TEAM
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Spin to land a random era &amp; team, then pick your component
          </p>
        </motion.div>

        {/* Lifelines Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto mb-5"
        >
          <div className="flex items-center justify-center gap-4">
            <div className={`lifeline-badge ${lifelinesUsed.respinTeam ? 'used' : ''}`}>
              <span className="text-base">🔄</span>
              <span className="font-heading text-[10px] font-bold tracking-wider"
                style={{ color: lifelinesUsed.respinTeam ? 'var(--text-muted)' : 'var(--accent-blue)' }}>
                {lifelinesUsed.respinTeam ? 'USED' : 'RESPIN TEAM'}
              </span>
            </div>
            <div className={`lifeline-badge ${lifelinesUsed.respinBoth ? 'used' : ''}`}>
              <span className="text-base">🎲</span>
              <span className="font-heading text-[10px] font-bold tracking-wider"
                style={{ color: lifelinesUsed.respinBoth ? 'var(--text-muted)' : 'var(--accent-amber)' }}>
                {lifelinesUsed.respinBoth ? 'USED' : 'RESPIN BOTH'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-heading uppercase tracking-widest"
              style={{ color: 'var(--text-secondary)' }}>
              Roster
            </span>
            <span className="text-xs font-heading font-bold"
              style={{ color: 'var(--accent-blue)' }}>
              {filledCount} / {DRAFT_SLOTS.length}
            </span>
          </div>
          <div className="progress-track">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(filledCount / DRAFT_SLOTS.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="progress-fill"
              style={{
                background: isComplete
                  ? 'linear-gradient(90deg, var(--accent-amber), var(--f1-red))'
                  : 'linear-gradient(90deg, var(--accent-blue), var(--accent-green))',
              }}
            />
          </div>
        </div>

        {/* Central SPIN button */}
        {!isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="text-center mb-8"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStartSpin}
              disabled={isSpinning}
              className="btn-spin"
              id="spin-btn"
            >
              🎰 SPIN FOR ERA &amp; TEAM
            </motion.button>
          </motion.div>
        )}

        {/* Slot grid */}
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {DRAFT_SLOTS.map((slot, index) => {
            const meta = SLOT_META[slot];
            const selection = roster[slot] ?? null;

            return (
              <SlotCard
                key={slot}
                meta={meta}
                selection={selection}
                index={index}
                gameMode={gameMode}
              />
            );
          })}
        </div>

        {/* All filled — show submit button if modal was closed */}
        {isComplete && !showSubmit && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-8"
          >
            <button
              onClick={() => setShowSubmit(true)}
              className="btn-primary text-lg px-12 py-4"
              id="open-submit-btn"
            >
              🏆 REVEAL TEAM RATING
            </button>
          </motion.div>
        )}

        {/* Back to home link */}
        <div className="text-center mt-8">
          <Link href="/" className="text-xs hover:underline"
            style={{ color: 'var(--text-muted)' }}>
            ← Cancel and Return Home
          </Link>
        </div>
      </div>

      <AnimatePresence>
        {/* Spinning overlay */}
        {isSpinning && (
          <SpinningWheel
            filledSlots={filledSlots}
            excludedNames={excludedNames}
            lifelinesUsed={lifelinesUsed}
            onSelect={handleSelect}
            onClose={handleCloseSpinner}
            onUseLifeline={handleUseLifeline}
            gameMode={gameMode}
          />
        )}

        {/* Submit / Reveal modal */}
        {showSubmit && isComplete && (
          <SubmitModal
            roster={roster as Record<DraftSlot, DraftSelection>}
            gameMode={gameMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
