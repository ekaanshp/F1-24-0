'use client';

// =============================================================================
// HomeClient — Landing Page
// =============================================================================

import { motion } from 'framer-motion';
import Link from 'next/link';

interface HomeClientProps {
  topScores: Array<{ playerName: string; totalPoints: number; decade: string }>;
}

export default function HomeClient({ topScores }: HomeClientProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative z-10">
        {/* Logo / Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm font-heading tracking-[0.3em] uppercase mb-4"
            style={{ color: 'var(--text-muted)' }}
          >
            Welcome to
          </motion.p>

          <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-black mb-4">
            <span style={{ color: 'var(--f1-red)' }}>F1</span>{' '}
            <span style={{ color: 'var(--text-primary)' }}>TEAM</span>
            <span style={{ color: 'var(--accent-blue)' }}>BUILDER</span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-base md:text-lg max-w-xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            Spin to land a random era and team. Draft 8 roster slots
            from across F1 history — from drivers and their engineers all the way to the chassis. 
            Use your lifelines wisely! Can you win every race in a F1 season with your team?
          </motion.p>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="w-full max-w-lg mb-8"
        >
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '🎰', title: 'SPIN', desc: 'Random era & team' },
              { icon: '🏎️', title: 'DRAFT', desc: 'Pick your component' },
              { icon: '🏆', title: 'SCORE', desc: 'Compete globally' },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="step-card text-center py-4 px-3"
              >
                <span className="text-2xl block mb-1">{step.icon}</span>
                <span className="font-heading text-xs font-bold tracking-wider block"
                  style={{ color: 'var(--accent-blue)' }}>{step.title}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{step.desc}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Game Setup Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="setup-card w-full max-w-lg p-8"
        >

          {/* Start Buttons */}
          <div className="flex flex-col gap-3">
            <Link href="/draft?mode=regular">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary w-full text-lg py-4"
                id="start-draft-btn"
              >
                START REGULAR DRAFT
              </motion.button>
            </Link>
            <Link href="/draft?mode=hardcore">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary w-full text-lg py-4"
                style={{
                  background: 'transparent',
                  border: '2px solid var(--f1-red)',
                  color: 'var(--f1-red)',
                }}
                id="start-hardcore-draft-btn"
              >
                🔥 START HARDCORE DRAFT 🔥
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Leaderboard Preview */}
        {topScores.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="leaderboard-card w-full max-w-lg mt-6 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-sm font-bold tracking-wider uppercase"
                style={{ color: 'var(--accent-amber)' }}>
                🏆 Top Players
              </h2>
              <Link href="/leaderboards"
                className="text-xs font-heading tracking-wider hover:underline"
                style={{ color: 'var(--accent-blue)' }}>
                View All →
              </Link>
            </div>
            <div className="space-y-2">
              {topScores.map((score, i) => (
                <div key={score.playerName}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                  <div className="flex items-center gap-3">
                    <span className={`font-heading text-xs font-bold w-6 text-center ${
                      i === 0 ? 'text-[var(--accent-amber)]' :
                      i === 1 ? 'text-gray-400' :
                      i === 2 ? 'text-amber-700' : ''
                    }`} style={i > 2 ? { color: 'var(--text-muted)' } : {}}>
                      #{i + 1}
                    </span>
                    <span className="text-sm font-medium">{score.playerName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {score.decade}
                    </span>
                    <span className="font-heading text-sm font-bold"
                      style={{ color: 'var(--accent-blue)' }}>
                      {score.totalPoints.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs relative z-10"
        style={{ color: 'var(--text-muted)' }}>
        F1 TeamBuilder — Built with historical F1 data
      </footer>
    </div>
  );
}
