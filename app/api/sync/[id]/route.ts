// Aktualisiert einen einzelnen Account (Button „Aktualisieren“).
import { NextResponse } from 'next/server';
import { syncProfile } from '@/lib/sync';
import { errorMessage } from '@/lib/util';

export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ ok: false, error: 'Ungültige ID' }, { status: 400 });
  try {
    return NextResponse.json(await syncProfile(n));
  } catch (e) {
    return NextResponse.json({ id: n, ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
