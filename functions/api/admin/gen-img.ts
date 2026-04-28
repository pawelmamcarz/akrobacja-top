import { type Env } from '../../../src/lib/types';

// Temporary one-shot endpoint — remove after image generation
const PROMPTS: Record<string, string> = {
  p1: 'product photo of a premium navy blue technical polo shirt, flat lay, embroidered Extra 300 aircraft on chest, cyan accent on collar, dark studio background, professional product photography',
  koszulka: 'product photo of a dark navy cotton t-shirt, flat lay, Extra 300 aerobatic airplane cyan graphic on chest, dark studio background, professional product photography',
  p2: 'product photo of a vivid cyan t-shirt, flat lay, dark navy aircraft silhouette on chest, dark studio background, professional product photography',
  czapka: 'product photo of a dark navy pilot baseball cap, structured 6-panel, embroidered aircraft logo on front, dark studio background, professional product photography',
  p3: 'product photo of a dark navy blue cotton t-shirt, flat lay, monochrome aircraft graphic, dark studio background, professional product photography',
  bluza: 'product photo of a dark navy softshell zip jacket, front view, embroidered aviation logo, ribbed cuffs, dark studio background, professional product photography',
  p4: 'product photo of a navy pilot softshell performance jacket, front view, aviation patches, dark studio background, professional product photography',
  zawieszka: 'product photo of a bright red aviation "Remove Before Flight" fabric tag keychain, embroidered text, hanging on dark background, macro studio shot',
  p5: 'product photo of a dark navy pullover hoodie, flat lay, large Extra 300 aircraft graphic on chest, kangaroo pocket, dark studio background, professional product photography',
  p6: 'product photo of a vivid cyan pullover hoodie, flat lay, dark aircraft silhouette graphic on chest, dark studio background, professional product photography',
  p7: 'product photo of a premium navy snapback cap, side angle, flat brim, embroidered aircraft logo, dark studio background, professional product photography',
  p8: 'product photo of a brushed aluminum laser-engraved keychain, Extra 300 aircraft silhouette engraved, dark background, macro studio lighting',
  p9: 'product photo of 4 waterproof vinyl aviation stickers, cyan and white Extra 300 aircraft designs, arranged on dark background, studio lighting',
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const id = new URL(ctx.request.url).searchParams.get('id');
  if (!id || !PROMPTS[id]) {
    return Response.json({ error: 'Unknown product id', ids: Object.keys(PROMPTS) }, { status: 400 });
  }

  const result = await ctx.env.AI.run('@cf/black-forest-labs/flux-1-schnell' as Parameters<typeof ctx.env.AI.run>[0], {
    prompt: PROMPTS[id],
    num_steps: 8,
  } as never) as { image: string } | ArrayBuffer;

  if (result instanceof ArrayBuffer) {
    return new Response(result, { headers: { 'Content-Type': 'image/jpeg' } });
  }
  const buf = Buffer.from((result as { image: string }).image, 'base64');
  return new Response(buf, { headers: { 'Content-Type': 'image/jpeg' } });
};
