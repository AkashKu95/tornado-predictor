import { NextResponse } from 'next/server';

export async function GET() {
  const res = NextResponse.json({ ok: true });

  // Instruct the browser to clear persistent state for this origin
  res.headers.set(
    'Clear-Site-Data',
    '"cache", "cookies", "storage", "executionContexts"'
  );

  return res;
}

