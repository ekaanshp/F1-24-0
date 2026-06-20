// =============================================================================
// Draft Page — /draft (The Spin Engine)
// =============================================================================

import type { Metadata } from 'next';
import DraftManager from '@/components/DraftManager';
import type { GameMode } from '@/types';

export const metadata: Metadata = {
  title: 'Draft Your Team — F1 TeamBuilder',
  description: 'Spin for legendary F1 components and build your ultimate team.',
};

export default function DraftPage({
  searchParams,
}: {
  searchParams: { mode?: string };
}) {
  const gameMode: GameMode = searchParams.mode === 'hardcore' ? 'hardcore' : 'regular';

  return (
    <main>
      <DraftManager gameMode={gameMode} />
    </main>
  );
}
