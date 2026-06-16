import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { simulateSeason } from '@/services/simulation';

const DRAFT_STATE_PREFIX = 'draft:';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const draftId = typeof body.draftId === 'string' ? body.draftId : undefined;

  if (!draftId) {
    return NextResponse.json({ message: 'draftId is required' }, { status: 400 });
  }

  const draftKey = `${DRAFT_STATE_PREFIX}${draftId}`;
  const draftRaw = await redis.get(draftKey);
  if (!draftRaw) {
    return NextResponse.json({ message: 'Draft not found' }, { status: 404 });
  }

  const draft = JSON.parse(draftRaw) as {
    selections: Array<{
      slot: string;
      componentName: string;
      team: string | null;
      rating: number;
      source: string;
    }>;
    slotIndex: number;
  };

  if (draft.slotIndex < 8 || draft.selections.length < 8) {
    return NextResponse.json({ message: 'Draft is not complete' }, { status: 400 });
  }

  const season = simulateSeason(draft.selections);
  return NextResponse.json({ season });
}
