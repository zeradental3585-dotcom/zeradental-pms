// Server-to-server proxy in front of the Zera PMS Google Apps Script backend.
//
// The dashboard at pms.zeradental.in calls this same-origin endpoint
// (/api/pms) via a plain fetch() — no CORS is involved, since both live on
// this origin. This function forwards the request to the Apps Script Web
// App over a normal server-to-server HTTP call (no browser, no framing
// involved) and relays back its JSON response (see the doPost "raw JSON
// body" path in Code.gs, which returns plain JSON for exactly this case).
//
// Why this exists: an earlier version had the browser POST directly into a
// hidden <iframe> targeting the Apps Script exec URL, since Apps Script Web
// Apps don't send CORS headers that allow cross-origin fetch(). That works
// for GET, but Google's own infrastructure blocks POST requests made into
// an iframe framed from a different origin — it returns a blanket HTTP 503,
// regardless of the iframe's visibility or the deployment's own "who has
// access" setting. That 503 was silently causing every real sign-in to hang
// until the frontend's own 20s timeout. Routing through this endpoint means
// the browser only ever talks to pms.zeradental.in — script.google.com is
// only ever called from this server, which has no framing restriction.
//
// No Vercel configuration or package.json is required: any file under
// /api/*.js is automatically deployed as a serverless function, and
// Vercel's Node runtime (18+) has global fetch built in.

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxhr8PmMAoxFM_zeheygEmEg4avaHa6uaVlkUGweqv265PM5LDFwwYzlIL7svfSxGlq/exec';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  var body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  if (!body || typeof body !== 'object' || !body.action) {
    res.status(400).json({ ok: false, error: 'bad_request' });
    return;
  }

  try {
    var upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
    var text = await upstream.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { ok: false, error: 'upstream_non_json', status: upstream.status };
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'upstream_unreachable', detail: String(err) });
  }
};
