// Relay in front of the Apps Script store. Apps Script's web-app front end often never answers,
// so this retries server-side with short timeouts and keeps the last good answer for 60s.
const STORE = 'https://script.google.com/macros/s/AKfycbxdixStSu3zncVM3f5IGjCnBj8k5IETum99bqpKmxL0cz4gqiaVctHNbqVLo081nu6c4A/exec';
const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'};
async function tryFetch(url, init, tries) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, Object.assign({redirect: 'follow', signal: AbortSignal.timeout(5000)}, init));
      const t = await r.text();
      JSON.parse(t);
      return t;
    } catch (e) {}
  }
  return null;
}
export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, {headers: CORS});
    const u = new URL(req.url);
    const hdr = Object.assign({'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, CORS);
    if (req.method === 'POST') {
      const body = await req.text();
      const t = await tryFetch(STORE, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body}, 3);
      return new Response(t || '{"error":"store busy"}', {status: t ? 200 : 502, headers: hdr});
    }
    const k = u.searchParams.get('k') || '';
    const cache = caches.default, key = new Request('https://relay.cache/' + encodeURIComponent(k));
    const fresh = u.searchParams.has('fresh');
    if (!fresh) { const hit = await cache.match(key); if (hit) return new Response(await hit.text(), {headers: hdr}); }
    const t = await tryFetch(STORE + '?k=' + encodeURIComponent(k), {}, 4);
    if (!t) { const hit = await cache.match(key); return hit ? new Response(await hit.text(), {headers: hdr}) : new Response('{"error":"store busy"}', {status: 502, headers: hdr}); }
    if (!JSON.parse(t).error) ctx.waitUntil(cache.put(key, new Response(t, {headers: {'Cache-Control': 'max-age=60'}})));
    return new Response(t, {headers: hdr});
  }
};
