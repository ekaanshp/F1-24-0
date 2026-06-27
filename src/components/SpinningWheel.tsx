'use client';

// =============================================================================
// SpinningWheel — Era+Team reveal then grouped component selection
// =============================================================================
// After spin: shows all available component types from the landed team.
// User picks any component they want and it auto-fills the correct slot.
// Respins actually re-trigger the spin and re-fetch new options.
// =============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spinForSlot, respinTeam, getAllPoolsForTeam } from '@/app/actions/game';
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect';
import type { ComponentOption, DraftSlot, GroupedOption, GameMode } from '@/types';

interface SpinningWheelProps {
  filledSlots: DraftSlot[];
  excludedNames: string[];
  lifelinesUsed: { respinTeam: boolean; respinBoth: boolean };
  onSelect: (option: ComponentOption, role: string, targetSlot: DraftSlot) => void;
  onClose: () => void;
  onUseLifeline: (type: 'respinTeam' | 'respinBoth') => void;
  gameMode?: GameMode;
}

type Phase = 'spinning' | 'options';

const DECADES_POOL = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const TEAMS_POOL = [
  'Ferrari', 'McLaren', 'Williams', 'Mercedes', 'Red Bull', 
  'Lotus', 'Brabham', 'Benetton', 'Renault', 'Tyrrell', 
  'Alfa Romeo', 'Maserati', 'Cooper', 'BRM', 'Honda',
  'Aston Martin', 'Alpine', 'Toro Rosso', 'AlphaTauri', 'Sauber',
  'Force India', 'Racing Point', 'Jordan', 'Minardi', 'Stewart'
];

function generateReel(target: string, pool: string[], length: number) {
  const reel = [];
  for (let i = 0; i < length - 1; i++) {
    reel.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  reel.push(target);
  return reel;
}

export default function SpinningWheel({
  filledSlots,
  excludedNames,
  lifelinesUsed,
  onSelect,
  onClose,
  onUseLifeline,
  gameMode = 'regular',
}: SpinningWheelProps) {
  const [phase, setPhase] = useState<Phase>('spinning');
  const [currentSpin, setCurrentSpin] = useState<{ decade: string; team: string } | null>(null);
  
  // Reels for slot machine animation
  const [decadeReel, setDecadeReel] = useState<string[]>([]);
  const [teamReel, setTeamReel] = useState<string[]>([]);
  
  const [groups, setGroups] = useState<GroupedOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // Initial spin on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    doSpin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllOptions = useCallback(async (decade: string, team: string) => {
    setIsLoadingOptions(true);
    setError(null);

    const result = await getAllPoolsForTeam(decade, team, filledSlots, excludedNames);

    if (result.error) {
      setError(result.error);
    } else if (result.groups.length === 0) {
      setError(`No available components for ${team} in the ${decade} era.`);
    } else {
      setGroups(result.groups);
    }

    setIsLoadingOptions(false);
    setPhase('options');
  }, [filledSlots, excludedNames]);

  const doSpin = useCallback(async () => {
    setPhase('spinning');
    setError(null);
    setGroups([]);

    const result = await spinForSlot();
    if (result.error) {
      setError(result.error);
      setPhase('options');
      return;
    }

    setCurrentSpin({ decade: result.decade, team: result.team });
    setDecadeReel(generateReel(result.decade, DECADES_POOL, 20));
    setTeamReel(generateReel(result.team, TEAMS_POOL, 30));

    // Wait for the slot machine animation to finish
    // Era finishes at 4s, Team finishes at 5s. Wait 5.5s before showing options.
    await new Promise((resolve) => setTimeout(resolve, 5500));

    // Fetch all available options
    await fetchAllOptions(result.decade, result.team);
  }, [fetchAllOptions]);

  // Lifeline: respin team (same era, different team)
  const handleRespinTeam = useCallback(async () => {
    if (!currentSpin || lifelinesUsed.respinTeam) return;
    onUseLifeline('respinTeam');

    setPhase('spinning');
    setGroups([]);
    setError(null);

    const result = await respinTeam(currentSpin.decade, currentSpin.team);
    if (result.error) {
      setError(result.error);
      setPhase('options');
      return;
    }

    setCurrentSpin({ decade: result.decade, team: result.team });
    // Keep the decade static (length 1 so it doesn't spin), but spin the team
    setDecadeReel([result.decade]);
    setTeamReel(generateReel(result.team, TEAMS_POOL, 30));

    // Wait for the slot machine animation
    await new Promise((resolve) => setTimeout(resolve, 5500));
    await fetchAllOptions(result.decade, result.team);
  }, [currentSpin, lifelinesUsed.respinTeam, onUseLifeline, fetchAllOptions]);

  // Lifeline: respin both (new era + new team)
  const handleRespinBoth = useCallback(async () => {
    if (!currentSpin || lifelinesUsed.respinBoth) return;
    onUseLifeline('respinBoth');

    setPhase('spinning');
    setGroups([]);
    setError(null);

    const result = await spinForSlot();
    if (result.error) {
      setError(result.error);
      setPhase('options');
      return;
    }

    setCurrentSpin({ decade: result.decade, team: result.team });
    setDecadeReel(generateReel(result.decade, DECADES_POOL, 20));
    setTeamReel(generateReel(result.team, TEAMS_POOL, 30));

    // Wait for the slot machine animation
    await new Promise((resolve) => setTimeout(resolve, 5500));
    await fetchAllOptions(result.decade, result.team);
  }, [currentSpin, lifelinesUsed.respinBoth, onUseLifeline, fetchAllOptions]);

  // When user picks a component, determine the target slot
  const handlePickComponent = useCallback((option: ComponentOption, group: GroupedOption) => {
    // Pick the first open slot for this role
    const targetSlot = group.availableSlots[0];
    if (!targetSlot) return;
    onSelect(option, group.role, targetSlot);
  }, [onSelect]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center py-6 px-4"
        style={{ background: 'rgba(0, 0, 0, 0.88)' }}
      >
        {/* Backdrop (no click to close) */}
        <div className="absolute inset-0" role="presentation" />

        <motion.div
          initial={{ scale: 0.8, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="overlay-panel relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col p-8"
        >

          {/* === SPINNING SLOT MACHINE === */}
          {phase === 'spinning' && (
            <div className="flex-1 flex flex-col items-center justify-center py-16">
              <div className="flex flex-row justify-center gap-8 md:gap-16 w-full">
                
                {/* Era Column */}
                <div className="flex flex-col items-center">
                  <span className="text-xs font-heading uppercase tracking-[0.3em] block mb-6" style={{ color: 'var(--text-muted)' }}>
                    Your Era
                  </span>
                  <div 
                    className="h-[100px] overflow-hidden relative w-[160px] md:w-[200px]" 
                    style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)' }}
                  >
                    <motion.div
                      initial={{ y: 0 }}
                      animate={{ y: -((decadeReel.length - 1) * 100) }}
                      transition={{ duration: 4, ease: [0.1, 0.7, 0.1, 1] }}
                    >
                      {decadeReel.map((item, i) => (
                        <div key={i} className="h-[100px] flex items-center justify-center font-heading text-4xl md:text-5xl font-black" style={{ color: 'var(--accent-blue)' }}>
                          {item}
                        </div>
                      ))}
                    </motion.div>
                  </div>
                </div>

                {/* Team Column */}
                <div className="flex flex-col items-center">
                  <span className="text-xs font-heading uppercase tracking-[0.3em] block mb-6" style={{ color: 'var(--text-muted)' }}>
                    Your Team
                  </span>
                  <div 
                    className="h-[100px] overflow-hidden relative w-[200px] md:w-[320px]" 
                    style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)' }}
                  >
                    <motion.div
                      initial={{ y: 0 }}
                      animate={{ y: -((teamReel.length - 1) * 100) }}
                      transition={{ duration: 5, ease: [0.1, 0.7, 0.1, 1] }}
                    >
                      {teamReel.map((item, i) => (
                        <div key={i} className="h-[100px] flex items-center justify-center font-heading text-3xl md:text-4xl font-black text-center px-4 leading-tight" style={{ color: 'var(--accent-amber)' }}>
                          {item}
                        </div>
                      ))}
                    </motion.div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* === OPTIONS PHASE === */}
          {phase === 'options' && (
            <>
              {/* Header with current spin */}
              <div className="text-center mb-4 shrink-0">
                <h2 className="font-heading text-lg font-bold tracking-wider uppercase"
                  style={{ color: 'var(--text-primary)' }}>
                  Choose a Component
                </h2>
                {currentSpin && (
                  <div className="flex items-center justify-center gap-3 mt-2">
                    <span className="font-heading text-sm font-bold"
                      style={{ color: 'var(--accent-amber)' }}>
                      {currentSpin.team}
                    </span>
                    <span style={{ color: 'var(--border-subtle)' }}>·</span>
                    <span className="font-heading text-sm font-bold"
                      style={{ color: 'var(--accent-blue)' }}>
                      {currentSpin.decade}
                    </span>
                  </div>
                )}
              </div>

              {/* Lifeline buttons */}
              <div className="flex items-center justify-center gap-3 mb-4 shrink-0">
                <motion.button
                  whileHover={!lifelinesUsed.respinTeam ? { scale: 1.05 } : {}}
                  whileTap={!lifelinesUsed.respinTeam ? { scale: 0.95 } : {}}
                  onClick={handleRespinTeam}
                  disabled={lifelinesUsed.respinTeam}
                  className="lifeline-btn"
                  style={{
                    opacity: lifelinesUsed.respinTeam ? 0.35 : 1,
                    cursor: lifelinesUsed.respinTeam ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span>🔄</span>
                  <span className="font-heading text-[10px] font-bold tracking-wider"
                    style={{ color: lifelinesUsed.respinTeam ? 'var(--text-muted)' : 'var(--accent-blue)' }}>
                    {lifelinesUsed.respinTeam ? 'USED' : 'RESPIN TEAM'}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={!lifelinesUsed.respinBoth ? { scale: 1.05 } : {}}
                  whileTap={!lifelinesUsed.respinBoth ? { scale: 0.95 } : {}}
                  onClick={handleRespinBoth}
                  disabled={lifelinesUsed.respinBoth}
                  className="lifeline-btn"
                  style={{
                    opacity: lifelinesUsed.respinBoth ? 0.35 : 1,
                    cursor: lifelinesUsed.respinBoth ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span>🎲</span>
                  <span className="font-heading text-[10px] font-bold tracking-wider"
                    style={{ color: lifelinesUsed.respinBoth ? 'var(--text-muted)' : 'var(--accent-amber)' }}>
                    {lifelinesUsed.respinBoth ? 'USED' : 'RESPIN BOTH'}
                  </span>
                </motion.button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto pr-1 min-h-0 mb-4">
                {/* Loading */}
                {isLoadingOptions && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-12 h-12 rounded-full border-4 border-t-transparent"
                      style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }}
                    />
                    <p className="font-heading text-xs mt-4 tracking-widest uppercase animate-pulse"
                      style={{ color: 'var(--accent-blue)' }}>
                      Loading Candidates...
                    </p>
                  </div>
                )}

                {/* Error */}
                {error && !isLoadingOptions && (
                  <div className="text-center py-12">
                    <p className="text-sm mb-6" style={{ color: 'var(--f1-red)' }}>{error}</p>
                    <button onClick={onClose} className="btn-primary text-sm px-6 py-2">
                      Go Back
                    </button>
                  </div>
                )}

                {/* Grouped options by role */}
                {!isLoadingOptions && !error && groups.length > 0 && (
                  <div className="space-y-6">
                    {groups.map((group) => (
                      <div key={group.role}>
                        {/* Role header */}
                        <div className="flex items-center gap-2 mb-3 pb-2"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <span className="text-xl">{group.icon}</span>
                          <h3 className="font-heading text-sm font-bold tracking-wider uppercase"
                            style={{ color: 'var(--text-secondary)' }}>
                            {group.label}
                          </h3>
                          <span className="text-[10px] font-heading ml-auto"
                            style={{ color: 'var(--text-muted)' }}>
                            {group.availableSlots.length} slot{group.availableSlots.length > 1 ? 's' : ''} open
                          </span>
                        </div>

                        {/* Options for this role */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {group.options.map((option, i) => (
                            <OptionCard
                              key={option.componentName}
                              option={option}
                              group={group}
                              index={i}
                              gameMode={gameMode}
                              onPick={handlePickComponent}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// OptionCard — Individual card with canvas-reveal hover effect
// =============================================================================

interface OptionCardProps {
  option: ComponentOption;
  group: GroupedOption;
  index: number;
  gameMode: GameMode;
  onPick: (option: ComponentOption, group: GroupedOption) => void;
}

function OptionCard({ option, group, index, gameMode, onPick }: OptionCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, type: 'spring', stiffness: 400 }}
      onClick={() => onPick(option, group)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="card-option text-left group flex flex-col justify-between h-full min-h-[120px] p-4 cursor-pointer"
      id={`option-${group.role}-${index}`}
    >
      {/* Canvas reveal effect on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-0"
          >
            <CanvasRevealEffect
              animationSpeed={5}
              containerClassName="bg-transparent"
              colors={[
                [99, 155, 210],
                [59, 130, 246],
              ]}
              opacities={[0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.4, 0.4, 1]}
              dotSize={2}
              showGradient={false}
            />
            {/* Radial fade mask */}
            <div
              className="absolute inset-0"
              style={{
                maskImage: 'radial-gradient(400px at center, white, transparent)',
                WebkitMaskImage: 'radial-gradient(400px at center, white, transparent)',
                background: 'rgba(10, 10, 15, 0.5)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card content */}
      <div className="relative z-10">
        <h4 className="font-heading text-sm font-bold tracking-wide mb-3 group-hover:text-[var(--accent-blue)] transition-colors line-clamp-2">
          {option.displayName || option.componentName}
        </h4>

        {/* Stats */}
        {gameMode !== 'hardcore' && (
          <div className="grid grid-cols-3 gap-1 py-1.5 px-2.5 rounded-lg text-xs"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-center">
              <span className="block text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Wins</span>
              <span className="font-heading font-bold text-xs" style={{ color: 'var(--accent-purple)' }}>
                {option.wins}
              </span>
            </div>
            <div className="text-center" style={{ borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }}>
              <span className="block text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Poles</span>
              <span className="font-heading font-bold text-xs" style={{ color: 'var(--accent-green)' }}>
                {option.poles}
              </span>
            </div>
            <div className="text-center">
              <span className="block text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pts</span>
              <span className="font-heading font-bold text-xs" style={{ color: 'var(--accent-amber)' }}>
                {option.points}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Select indicator */}
      <div className="relative z-10 mt-3 text-center shrink-0">
        <span className="text-[10px] font-heading uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--accent-blue)' }}>
          ▸ SELECT ◂
        </span>
      </div>
    </motion.button>
  );
}
