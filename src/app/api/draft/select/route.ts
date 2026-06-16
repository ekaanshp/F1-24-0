import { NextRequest, NextResponse } from 'next/server';
import { selectDraftComponent } from '@/services/draft';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const draftId = typeof body.draftId === 'string' ? body.draftId : undefined;
  const componentName = typeof body.componentName === 'string' ? body.componentName : undefined;

  if (!draftId || !componentName) {
    return NextResponse.json(
      { message: 'draftId and componentName are required' },
      { status: 400 },
    );
  }

  try {
    const state = await selectDraftComponent(draftId, componentName);
    return NextResponse.json({
      draftId: state.draftId,
      selections: state.selections,
      nextSlotIndex: state.slotIndex,
      isComplete: state.selections.length >= 8,
    });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || 'Draft select failed' },
      { status: 400 },
    );
  }
}
