/**
 * Live METAR feed for hero HUD strip.
 *
 * Source: NOAA Aviation Weather API (no auth, no key, free).
 * Station: EPRA (Radom-Sadków) — closest METAR-issuing field to EPRP Piastów (~8 km).
 * EPRP itself is uncontrolled GA grass and does not issue METAR.
 *
 * Cached at CF edge for 5 min (METAR cycle is 30 min, so ~10x reduction).
 * Failure modes: returns ok:false; client falls back to static defaults.
 */

interface MetarRaw {
  wdir?: number | string;
  wspd?: number;
  wgst?: number;
  visib?: number | string;
  clouds?: Array<{ cover?: string; base?: number | null }>;
  wxString?: string | null;
  rawOb?: string;
  obsTime?: string;
}

const STATION = 'EPRA';
const URL_NOAA = `https://aviationweather.gov/api/data/metar?ids=${STATION}&format=json&taf=false&hours=2`;

export const onRequest: PagesFunction = async () => {
  try {
    const r = await fetch(URL_NOAA, {
      headers: { 'User-Agent': 'akrobacja.com/1.0 (dto@akrobacja.com)' },
      cf: { cacheTtl: 300, cacheEverything: true } as RequestInitCfProperties,
    });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const data = (await r.json()) as MetarRaw[];
    const m = data?.[0];
    if (!m) throw new Error('no metar in response');

    const wdirNum = typeof m.wdir === 'number' ? m.wdir : parseInt(String(m.wdir ?? ''), 10);
    const wspd = typeof m.wspd === 'number' ? m.wspd : 0;
    const wind =
      Number.isFinite(wdirNum) && wdirNum >= 0 && wdirNum <= 360
        ? `${String(wdirNum).padStart(3, '0')}/${String(wspd).padStart(2, '0')}`
        : 'VRB/00';

    const visibStr = String(m.visib ?? '');
    const visibKm =
      visibStr === '10+' || visibStr === '6+' ? 10 : parseFloat(visibStr) || 0;
    const cloudsLow =
      m.clouds?.some(
        (c) =>
          c.cover &&
          !['CLR', 'SKC', 'NSC', 'NCD'].includes(c.cover) &&
          (c.base ?? Infinity) < 5000,
      ) ?? false;
    const cavok = visibKm >= 10 && !cloudsLow && !m.wxString;
    const conditions = cavok
      ? 'CAVOK'
      : m.wxString
      ? String(m.wxString).slice(0, 12).toUpperCase()
      : (m.clouds?.[0]?.cover ?? 'NSC').toUpperCase();

    // EPRP active runway from EPRA wind (paved RWY 09/27).
    // RWY 27 (270°) used for headwinds 180–360°; RWY 09 for 0–180°.
    const rwy = !Number.isFinite(wdirNum)
      ? 'RWY 27'
      : wdirNum >= 180 && wdirNum <= 360
      ? 'RWY 27'
      : 'RWY 09';

    return new Response(
      JSON.stringify({
        ok: true,
        station: STATION,
        observed: m.obsTime ?? null,
        raw: m.rawOb ?? null,
        wind,
        conditions,
        rwy,
      }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=900',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=60',
        },
      },
    );
  }
};
