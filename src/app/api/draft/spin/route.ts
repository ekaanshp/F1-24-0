// =============================================================================
// POST /api/draft/spin — F1 TeamBuilder
// =============================================================================
// Generates a randomized Team + Era for the current spin.
// The spin result is server-authoritative to prevent client spoofing.
//
// TODO(security): Implement rate limiting to prevent RNG abuse
// TODO(security): Validate user session before processing spin
// TODO(security): Verify draft session ownership (user can only spin their own)
// TODO: Implement the actual spin logic (RNG, era/team selection)
// =============================================================================

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO: Implement spin logic
  // 1. Authenticate user session
  // 2. Validate active draft session exists and belongs to user
  // 3. Check remaining spins
  // 4. Generate randomized team/era from HistoricalData
  // 5. Store spin result server-side (prevent client spoofing)
  // 6. Return spin result to client

  return NextResponse.json(
    { message: 'POST /api/draft/spin — Not yet implemented' },
    { status: 501 },
  );
}
