// _worker.js — Cloudflare Pages edge proxy for TheGreatPapyrus bot API.
// Netlify-style _redirects can't proxy external domains on Cloudflare, so this
// worker forwards /api/* to the bot on WispByte (m42 web API) and serves the
// static site for everything else.
const BOT_API = "http://78.154.103.11.nip.io:15657";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const target = BOT_API + url.pathname + url.search;
      try {
        const res = await fetch(target, {
          method: request.method,
          headers: request.headers,
          body: request.method !== "GET" && request.method !== "HEAD"
            ? await request.arrayBuffer()
            : undefined,
          redirect: "manual",
        });
        // pass the bot's response straight through (incl. 401/403 from m42 auth)
        return new Response(res.body, res);
      } catch (e) {
        return new Response(JSON.stringify({ error: "bot API unreachable: " + String(e) }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
