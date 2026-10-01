/**
 * worker.js - Free Cloudflare Worker Proxy for Pexels & Pixabay Stock APIs
 * 
 * Features:
 * - Keeps API keys secure server-side (stored as Cloudflare Worker Secrets).
 * - Implements strict CORS headers (Access-Control-Allow-Origin: *).
 * - Caches search results edge-side (Cloudflare Cache API) to respect rate limits.
 * - Forwards portrait/vertical video queries for 9:16 vertical video generators.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'docuforge-stock-proxy' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (url.pathname !== '/search') {
      return new Response(JSON.stringify({ error: 'Endpoint not found. Use /search?service=pexels|pixabay&query=...' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const service = url.searchParams.get('service') || 'pexels';
    const query = url.searchParams.get('query') || '';
    const orientation = url.searchParams.get('orientation') || 'portrait';
    const perPage = url.searchParams.get('per_page') || '10';

    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Check Cloudflare Edge Cache
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;
    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const newHeaders = new Headers(cachedResponse.headers);
      newHeaders.set('X-Cache-Status', 'HIT');
      newHeaders.set('Access-Control-Allow-Origin', '*');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        headers: newHeaders
      });
    }

    try {
      let upstreamUrl = '';
      const headers = {};

      if (service === 'pexels') {
        const apiKey = env.PEXELS_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'PEXELS_API_KEY not configured on worker' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        upstreamUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}`;
        headers['Authorization'] = apiKey;
      } else if (service === 'pixabay') {
        const apiKey = env.PIXABAY_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'PIXABAY_API_KEY not configured on worker' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        const pixabayOrient = (orientation === 'portrait') ? 'vertical' : 'all';
        upstreamUrl = `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&orientation=${pixabayOrient}&video_type=film&per_page=${perPage}`;
      } else {
        return new Response(JSON.stringify({ error: 'Unsupported service. Use pexels or pixabay.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const upstreamRes = await fetch(upstreamUrl, { headers });
      if (!upstreamRes.ok) {
        return new Response(JSON.stringify({ error: `Upstream ${service} error: ${upstreamRes.status}` }), {
          status: upstreamRes.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const data = await upstreamRes.text();
      const response = new Response(data, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'X-Cache-Status': 'MISS'
        }
      });

      // Cache successful response in edge cache
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
