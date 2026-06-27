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

export default async function DraftPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const resolvedParams = await searchParams;
  const gameMode: GameMode = resolvedParams.mode === 'hardcore' ? 'hardcore' : 'regular';

  return (
    <main>
      <DraftManager gameMode={gameMode} />
    </main>
  );
}
