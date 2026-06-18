import { NextRequest, NextResponse } from 'next/server';
import { getNextDraftSpin } from '@/services/draft';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const draftId = typeof body.draftId === 'string' ? body.draftId : undefined;

  try {
    const state = await getNextDraftSpin(draftId);
    return NextResponse.json({
      draftId: state.draftId,
      decade: state.decade,
      slotIndex: state.slotIndex,
      totalSlots: 8,
      options: state.options,
      selections: state.selections,
      isComplete: state.slotIndex >= 8,
    });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || 'Draft spin failed' },
      { status: 500 },
    );
  }
}
