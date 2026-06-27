'use client';

// =============================================================================
// CanvasRevealEffect — Dot-matrix reveal animation on canvas (optimized)
// =============================================================================
// Stops the animation loop once all dots have fully faded in,
// instead of running requestAnimationFrame forever.
// =============================================================================

import React, { useEffect, useRef, useMemo } from 'react';

interface CanvasRevealEffectProps {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
}

interface DotConfig {
  x: number;
  y: number;
  radius: number;
  color: string;
  targetOpacity: number;
  currentOpacity: number;
  delay: number;
}

export function CanvasRevealEffect({
  animationSpeed = 3,
  opacities = [0.1, 0.1, 0.1, 0.15, 0.15, 0.2, 0.2, 0.25, 0.3, 0.4],
  colors = [[139, 0, 0]],
  containerClassName = '',
  dotSize = 3,
  showGradient = true,
}: CanvasRevealEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const dotsRef = useRef<DotConfig[]>([]);

  const colorStrings = useMemo(
    () => colors.map((c) => `${c[0]}, ${c[1]}, ${c[2]}`),
    [colors],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      // Use devicePixelRatio for crisp rendering but cap at 2x to save perf
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.offsetWidth * dpr;
      canvas.height = parent.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = parent.offsetWidth + 'px';
      canvas.style.height = parent.offsetHeight + 'px';
      initDots(parent.offsetWidth, parent.offsetHeight);
    };

    const initDots = (width: number, height: number) => {
      const dots: DotConfig[] = [];
      const spacing = dotSize * 5; // Slightly wider spacing = fewer dots = faster
      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);
      const centerX = width / 2;
      const centerY = height / 2;
      const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing + spacing / 2;
          const y = j * spacing + spacing / 2;
          const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          const normalizedDist = dist / maxDist;

          const colorStr = colorStrings[Math.floor(Math.random() * colorStrings.length)];
          const targetOpacity = opacities[Math.floor(Math.random() * opacities.length)];

          dots.push({
            x,
            y,
            radius: dotSize / 2,
            color: colorStr,
            targetOpacity,
            currentOpacity: 0,
            delay: normalizedDist * (1000 / animationSpeed),
          });
        }
      }
      dotsRef.current = dots;
    };

    let allDone = false;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let stillAnimating = false;

      for (const dot of dotsRef.current) {
        if (elapsed > dot.delay) {
          const progress = Math.min((elapsed - dot.delay) / (300 / animationSpeed), 1);
          dot.currentOpacity = dot.targetOpacity * easeOutCubic(progress);
          if (progress < 1) stillAnimating = true;
        } else {
          stillAnimating = true;
        }

        if (dot.currentOpacity > 0.001) {
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${dot.color}, ${dot.currentOpacity})`;
          ctx.fill();
        }
      }

      if (stillAnimating && !allDone) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        allDone = true;
        // Final frame is already drawn, stop the loop
      }
    };

    resizeCanvas();
    startTimeRef.current = 0;
    allDone = false;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [animationSpeed, colorStrings, dotSize, opacities]);

  return (
    <div className={`h-full w-full relative ${containerClassName}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {showGradient && (
        <div
          className="absolute inset-0"
          style={{
            maskImage: 'radial-gradient(300px at center, white, transparent)',
            WebkitMaskImage: 'radial-gradient(300px at center, white, transparent)',
            background: 'rgba(0, 0, 0, 0.4)',
          }}
        />
      )}
    </div>
  );
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
