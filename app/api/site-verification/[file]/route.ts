// Liefert optional die Verifizierungsdatei aus, falls TikTok sie für deine Domain verlangt.
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const name = process.env.TIKTOK_VERIFICATION_FILE;
  const content = process.env.TIKTOK_VERIFICATION_CONTENT;
  if (!name || !content || file !== name) return new Response('Not found', { status: 404 });
  return new Response(content, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
