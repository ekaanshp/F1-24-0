'use client';

// =============================================================================
// BackgroundGradientAnimation — Ambient animated gradient blobs (GPU-optimized)
// =============================================================================
// Uses pure CSS transforms + opacity for GPU-composited layers.
// No SVG filters, no JS animation loops, no blur() filter.
// =============================================================================

export function BackgroundGradientAnimation({
  children,
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`fixed inset-0 overflow-hidden ${className}`}
      style={{ zIndex: 0, pointerEvents: 'none' }}
    >
      {/* Gradient container — use opacity instead of heavy blur filter */}
      <div
        className="w-full h-full"
        style={{ opacity: 0.15 }}
      >
        {/* Blob 1 — Deep crimson, vertical movement */}
        <div
          className="absolute will-change-transform"
          style={{
            width: '80%',
            height: '80%',
            top: 'calc(50% - 40%)',
            left: 'calc(50% - 40%)',
            background: 'radial-gradient(circle at center, rgba(139, 0, 0, 0.8) 0%, rgba(92, 0, 0, 0) 50%)',
            mixBlendMode: 'hard-light',
            animation: 'var(--animate-first)',
            transform: 'translateZ(0)',
          }}
        />

        {/* Blob 2 — Darker maroon, circular reverse */}
        <div
          className="absolute will-change-transform"
          style={{
            width: '70%',
            height: '70%',
            top: 'calc(50% - 35%)',
            left: 'calc(50% - 35%)',
            background: 'radial-gradient(circle at center, rgba(92, 0, 0, 0.8) 0%, rgba(61, 0, 0, 0) 50%)',
            mixBlendMode: 'hard-light',
            animation: 'var(--animate-second)',
            transform: 'translateZ(0)',
          }}
        />

        {/* Blob 3 — Warm amber hint, circular */}
        <div
          className="absolute will-change-transform"
          style={{
            width: '60%',
            height: '60%',
            top: 'calc(50% - 30%)',
            left: 'calc(50% - 30%)',
            background: 'radial-gradient(circle at center, rgba(180, 80, 0, 0.6) 0%, rgba(100, 30, 0, 0) 50%)',
            mixBlendMode: 'hard-light',
            animation: 'var(--animate-third)',
            transform: 'translateZ(0)',
          }}
        />

        {/* Blob 4 — F1 red, horizontal */}
        <div
          className="absolute will-change-transform"
          style={{
            width: '80%',
            height: '80%',
            top: 'calc(50% - 40%)',
            left: 'calc(50% - 40%)',
            background: 'radial-gradient(circle at center, rgba(225, 6, 0, 0.6) 0%, rgba(139, 0, 0, 0) 50%)',
            mixBlendMode: 'hard-light',
            animation: 'var(--animate-fourth)',
            transform: 'translateZ(0)',
          }}
        />

        {/* Blob 5 — Muted deep red, circular */}
        <div
          className="absolute will-change-transform"
          style={{
            width: '70%',
            height: '70%',
            top: 'calc(50% - 35%)',
            left: 'calc(50% - 35%)',
            background: 'radial-gradient(circle at center, rgba(61, 0, 0, 0.8) 0%, rgba(30, 0, 0, 0) 50%)',
            mixBlendMode: 'hard-light',
            animation: 'var(--animate-fifth)',
            transform: 'translateZ(0)',
          }}
        />
      </div>

      {/* Content overlay */}
      {children}
    </div>
  );
}
