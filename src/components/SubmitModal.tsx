'use client';

// =============================================================================
// SubmitModal — Two-phase Rating Reveal and Leaderboard Submission
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { checkNameAvailability, submitFinalScore, calculateScore } from '@/app/actions/game';
import { DRAFT_SLOTS, PLAYER_NAME_REGEX } from '@/lib/constants';
import type { DraftSelection, DraftSlot, SubmitResult, GameMode } from '@/types';
import { ConfettiFireworks } from '@/components/ui/confetti-fireworks';
import { ConfettiSideCannons } from '@/components/ui/confetti-side-cannons';

interface SubmitModalProps {
  roster: Record<DraftSlot, DraftSelection>;
  gameMode?: GameMode;
}

type ModalPhase = 'reveal' | 'nickname' | 'success' | 'error';

function getPerformanceMetrics(score: number): { grade: string; prediction: string; gradeColor: string } {
  let grade = 'F';
  let gradeColor = 'var(--f1-red)';
  let wins = 0;

  if (score >= 98) { grade = 'S+'; gradeColor = '#ffb703'; wins = 24; }
  else if (score >= 95) { grade = 'S'; gradeColor = '#ffb703'; wins = 22; }
  else if (score >= 90) { grade = 'A+'; gradeColor = '#4ade80'; wins = 19; }
  else if (score >= 85) { grade = 'A'; gradeColor = '#4ade80'; wins = 14; }
  else if (score >= 80) { grade = 'B'; gradeColor = '#60a5fa'; wins = 9; }
  else if (score >= 75) { grade = 'C'; gradeColor = '#facc15'; wins = 4; }
  else if (score >= 70) { grade = 'D'; gradeColor = '#fb923c'; wins = 1; }
  else { grade = 'F'; gradeColor = '#f87171'; wins = 0; }

  if (score < 98 && score >= 70) {
    const pct = (score - 70) / 28;
    wins = Math.round(Math.pow(pct, 1.5) * 24);
  }

  wins = Math.max(0, Math.min(24, wins));
  return { grade, prediction: `${wins}-${24 - wins}`, gradeColor };
}

export default function SubmitModal({
  roster,
  gameMode = 'regular',
}: SubmitModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('reveal');
  const [teamScore, setTeamScore] = useState<number | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(true);

  const [playerName, setPlayerName] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Collect unique decades for display
  const uniqueDecades = [...new Set(DRAFT_SLOTS.map((slot) => roster[slot].decade))];
  const decadeLabel = uniqueDecades.length === 1 ? uniqueDecades[0] : 'Mixed Eras';

  // Fetch score on mount — each selection carries its own decade
  useEffect(() => {
    async function fetchScore() {
      setIsLoadingScore(true);
      try {
        const selections = DRAFT_SLOTS.map((slot) => ({
          slot,
          componentName: roster[slot].componentName,
          decade: roster[slot].decade,
        }));
        const res = await calculateScore(selections);
        setTeamScore(res.totalPoints);
      } catch {
        setTeamScore(null);
      }
      setIsLoadingScore(false);
    }
    fetchScore();
  }, [roster]);

  // Focus input when moving to nickname phase
  useEffect(() => {
    if (phase === 'nickname') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  const handleNameChange = useCallback((value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    setPlayerName(sanitized);
    setIsAvailable(null);
    setNameError(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (sanitized.length < 3) {
      if (sanitized.length > 0) {
        setNameError('Name must be at least 3 characters');
      }
      return;
    }

    if (!PLAYER_NAME_REGEX.test(sanitized)) {
      setNameError('Only letters, numbers, and underscores');
      return;
    }

    setIsChecking(true);
    debounceRef.current = setTimeout(async () => {
      const { available, error } = await checkNameAvailability(sanitized);
      setIsChecking(false);
      if (error) {
        setNameError(error);
      } else {
        setIsAvailable(available);
        if (!available) {
          setNameError('This name is already taken');
        }
      }
    }, 500);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isAvailable || isSubmitting) return;

    setIsSubmitting(true);

    const selections = DRAFT_SLOTS.map((slot) => ({
      slot,
      componentName: roster[slot].componentName,
      displayName: roster[slot].displayName,
      decade: roster[slot].decade,
    }));

    const submitResult = await submitFinalScore({
      playerName,
      gameMode,
      selections,
    });

    setResult(submitResult);
    if (submitResult.success) {
      setPhase('success');
    } else {
      setPhase('error');
    }
    setIsSubmitting(false);
  }, [isAvailable, isSubmitting, playerName, roster, gameMode]);

  const canSubmit = isAvailable === true && !isChecking && !isSubmitting && playerName.length >= 3;

  // --- Success screen ---
  if (phase === 'success' && result?.success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0, 0, 0, 0.92)' }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="overlay-panel w-full max-w-md p-10 text-center"
        >
          <div className="text-6xl mb-6">🏆</div>

          <h2 className="font-heading text-2xl font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}>
            POSITION RECORDED!
          </h2>

          <div className="my-8">
            <p className="font-heading text-5xl font-black mb-1"
              style={{ color: 'var(--accent-amber)' }}>
              {result.totalPoints?.toFixed(1)}
            </p>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
              Roster Rating
            </p>
            
            {result.totalPoints && (
              <div className="flex items-center justify-center gap-6 mb-6 mt-4">
                <div className="text-center">
                  <span className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: 'var(--text-secondary)' }}>Grade</span>
                  <span className="font-heading text-2xl font-bold" style={{ color: getPerformanceMetrics(result.totalPoints).gradeColor }}>
                    {getPerformanceMetrics(result.totalPoints).grade}
                  </span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <span className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: 'var(--text-secondary)' }}>Prediction</span>
                  <span className="font-heading text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {getPerformanceMetrics(result.totalPoints).prediction}
                  </span>
                </div>
              </div>
            )}
          </div>

          {result.rank && (
            <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
              You are ranked <span className="font-bold" style={{ color: 'var(--accent-blue)' }}>
                #{result.rank}
              </span> on the leaderboard
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Link href="/leaderboards" className="btn-primary text-center text-sm block">
              View Leaderboard
            </Link>
            <Link href="/" className="text-sm text-center hover:underline"
              style={{ color: 'var(--text-secondary)' }}>
              Draft New Team
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Error screen ---
  if (phase === 'error' && result && !result.success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0, 0, 0, 0.92)' }}>
        <div className="overlay-panel w-full max-w-md p-10 text-center">
          <p className="text-4xl mb-4">❌</p>
          <h2 className="font-heading text-xl font-bold mb-3" style={{ color: 'var(--f1-red)' }}>
            Submission Failed
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            {result.error}
          </p>
          <button onClick={() => setPhase('nickname')} className="btn-primary text-sm">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // --- Phase 1: Reveal Rating ---
  if (phase === 'reveal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8 px-4"
        style={{ background: 'rgba(0, 0, 0, 0.92)' }}>
        <motion.div
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="overlay-panel w-full max-w-lg p-8 relative"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Draft Complete · {decadeLabel}
            </span>
            <h2 className="font-heading text-2xl font-bold tracking-wider mt-2"
              style={{ color: 'var(--text-primary)' }}>
              TEAM PERFORMANCE REVIEW
            </h2>
          </div>

          {/* Rating reveal */}
          <div className="flex flex-col items-center justify-center py-10 mb-8"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '1rem' }}>
            {isLoadingScore ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 rounded-full border-4 border-t-transparent"
                  style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }}
                />
                <p className="font-heading text-sm mt-6 tracking-widest uppercase animate-pulse"
                  style={{ color: 'var(--accent-blue)' }}>
                  Calculating Rating...
                </p>
              </>
            ) : (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="text-center w-full"
              >
                <div className="mb-6">
                  <span className="text-xs uppercase tracking-widest font-semibold block mb-1"
                    style={{ color: 'var(--text-muted)' }}>
                    Overall Rating
                  </span>
                  <span className="font-heading text-6xl md:text-7xl font-black"
                    style={{ color: 'var(--accent-amber)' }}>
                    {teamScore !== null ? teamScore.toFixed(1) : '—'}
                  </span>
                </div>
                
                {teamScore !== null && (
                  <div className="flex items-center justify-center gap-6 px-4 mb-4 mt-2">
                    <div className="text-center">
                      <span className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: 'var(--text-secondary)' }}>Grade</span>
                      <span className="font-heading text-3xl font-bold" style={{ color: getPerformanceMetrics(teamScore).gradeColor }}>
                        {getPerformanceMetrics(teamScore).grade}
                      </span>
                    </div>
                    <div className="w-px h-12 bg-white/10" />
                    <div className="text-center">
                      <span className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: 'var(--text-secondary)' }}>Season Prediction</span>
                      <span className="font-heading text-3xl font-bold tracking-wider" style={{ color: 'var(--text-primary)' }}>
                        {getPerformanceMetrics(teamScore).prediction}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-[10px] mt-8 max-w-xs mx-auto px-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Computed from F1 historical career-aggregated and peak-weighted metrics across {uniqueDecades.length} era{uniqueDecades.length > 1 ? 's' : ''}.
                </p>
              </motion.div>
            )}
          </div>

          {/* Action buttons */}
          {!isLoadingScore && (
            <>
              {teamScore !== null && teamScore >= 95 && (
                <>
                  <ConfettiFireworks />
                  <ConfettiSideCannons />
                </>
              )}
              <div className="space-y-3">
              <button
                onClick={() => setPhase('nickname')}
                className="btn-primary w-full text-center py-4 text-base font-bold tracking-wider"
              >
                🏆 SUBMIT TO GLOBAL LEADERBOARD
              </button>
              <Link
                href="/"
                className="btn-secondary w-full text-center py-4 text-sm block"
              >
                🎮 SKIP &amp; PLAY AGAIN
              </Link>
            </div>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // --- Phase 2: Enter Nickname ---
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8 px-4"
        style={{ background: 'rgba(0, 0, 0, 0.92)' }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="overlay-panel w-full max-w-md p-8"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="font-heading text-lg font-bold tracking-wider"
              style={{ color: 'var(--text-primary)' }}>
              LEADERBOARD ENTRY
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Your rating of <span className="font-bold" style={{ color: 'var(--accent-amber)' }}>{teamScore?.toFixed(1)}</span> will be submitted.
            </p>
          </div>

          {/* Name input */}
          <div className="mb-6">
            <label htmlFor="player-name-input"
              className="block text-xs uppercase tracking-widest mb-2 font-heading"
              style={{ color: 'var(--text-secondary)' }}>
              Enter Your Name
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="player-name-input"
                type="text"
                value={playerName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="YOUR_NAME"
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl text-base font-heading font-bold tracking-wider uppercase outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: `2px solid ${
                    nameError ? 'var(--f1-red)' :
                    isAvailable ? 'var(--accent-green)' :
                    'var(--border-subtle)'
                  }`,
                  color: 'var(--text-primary)',
                }}
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isChecking && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 rounded-full border-2 border-t-transparent"
                    style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }}
                  />
                )}
                {!isChecking && isAvailable === true && (
                  <span style={{ color: 'var(--accent-green)' }}>✓</span>
                )}
                {!isChecking && isAvailable === false && (
                  <span style={{ color: 'var(--f1-red)' }}>✗</span>
                )}
              </div>
            </div>
            {nameError && (
              <p className="text-xs mt-1" style={{ color: 'var(--f1-red)' }}>
                {nameError}
              </p>
            )}
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              3-20 characters · Letters, numbers, underscores
            </p>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary w-full text-center"
            id="submit-score-btn"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent border-white"
                />
                Submitting...
              </span>
            ) : (
              'CLAIM MY SPOT'
            )}
          </button>

          {/* Back button */}
          <button
            onClick={() => setPhase('reveal')}
            className="w-full text-center text-xs mt-4 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            ← View Roster Overall Again
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
