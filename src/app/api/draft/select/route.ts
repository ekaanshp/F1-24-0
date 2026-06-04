// =============================================================================
// POST /api/draft/select — F1 TeamBuilder
// =============================================================================
// Locks in the user's component choice for the current spin.
// Server validates that the selected component was actually offered.
//
// TODO(security): Implement rate limiting
// TODO(security): Validate user session before processing selection
// TODO(security): Server-side validation that the selected component matches
//                 the spin result (prevent client spoofing)
// TODO: Implement the actual selection logic
// =============================================================================

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO: Implement select logic
  // 1. Authenticate user session
  // 2. Validate active draft session
  // 3. Verify the selected component was part of the spin result (anti-cheat)
  // 4. Lock in the component to the roster
  // 5. Advance draft state (increment spinsUsed, check if roster complete)
  // 6. Return updated draft state

  return NextResponse.json(
    { message: 'POST /api/draft/select — Not yet implemented' },
    { status: 501 },
  );
}
