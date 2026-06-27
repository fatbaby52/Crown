// Event-triggered Netlify function.
// The name "deploy-succeeded" makes Netlify run this automatically after every
// successful production deploy — i.e. once the new content is already live.
//
// It notifies IndexNow (Bing, DuckDuckGo, Yandex, Ecosia — and Bing powers
// ChatGPT search) that the site's pages may have changed, so they re-crawl
// sooner. Google does NOT use IndexNow and is unaffected by this.
//
// The IndexNow "key" is not a secret: it's published at /<key>.txt to prove
// domain ownership, so hardcoding it here is fine and avoids env-var setup.

const HOST = 'crownconsultingteam.com';
const INDEXNOW_KEY = '85adb61c21a346a6b221547c91a5ce41';
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;

exports.handler = async function () {
  try {
    // Pull the current URL list from the live sitemap so this stays in sync
    // automatically as pages are added or removed.
    const sitemapRes = await fetch(SITEMAP_URL, {
      headers: { 'User-Agent': 'CrownIndexNow/1.0' },
    });

    if (!sitemapRes.ok) {
      console.error(`IndexNow: could not fetch sitemap (HTTP ${sitemapRes.status})`);
      return { statusCode: 200, body: 'Sitemap fetch failed; IndexNow skipped.' };
    }

    const xml = await sitemapRes.text();
    const urlList = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

    if (urlList.length === 0) {
      console.warn('IndexNow: no <loc> URLs found in sitemap; nothing submitted.');
      return { statusCode: 200, body: 'No URLs to submit.' };
    }

    const submitRes = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: KEY_LOCATION,
        urlList,
      }),
    });

    console.log(`IndexNow: submitted ${urlList.length} URLs, response HTTP ${submitRes.status}`);
    return {
      statusCode: 200,
      body: `Submitted ${urlList.length} URLs to IndexNow (HTTP ${submitRes.status}).`,
    };
  } catch (err) {
    console.error('IndexNow: submission errored:', err);
    // Never fail the deploy pipeline over this.
    return { statusCode: 200, body: 'IndexNow submission errored; see function logs.' };
  }
};
