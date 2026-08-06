import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { recordHandoffEvent } from '@/lib/analytics/handoff-events';

/**
 * Records a trust-bridge interaction event from the client.
 * Validates the payload against the same schema used server-side.
 * Never blocks — returns 204 immediately, records async.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productSlug, retailer, market, interaction } = body;

    if (typeof productSlug !== 'string' || typeof retailer !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (market !== 'NG' && market !== 'US') {
      return NextResponse.json({ error: 'Invalid market' }, { status: 400 });
    }

    const validInteractions = ['viewed', 'continue', 'alternative', 'cancelled'];
    if (!validInteractions.includes(interaction)) {
      return NextResponse.json({ error: 'Invalid interaction' }, { status: 400 });
    }

    after(() => recordHandoffEvent({
      productSlug,
      retailer,
      market,
      interaction,
    }));

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
