// Per-clinic Web App Manifest, so each clinic's "Add to Home Screen" icon
// shows THEIR name and opens straight into THEIR dashboard, not a generic
// "Zera PMS" shell.
//
// The frontend's <head> points <link rel="manifest"> at
// /api/manifest?c=<slug> whenever a clinic slug is present in the page URL
// (see index.html). This function reads that slug, asks the Apps Script
// backend for the clinic's display name (the same public, unauthenticated
// "getClinicBranding" action the login screen already uses), and returns a
// manifest whose name/short_name/start_url are tailored to that clinic.
//
// Same server-to-server pattern as api/pms.js, and for the same reason:
// Apps Script Web Apps block cross-origin browser calls, so this is fetched
// from Vercel's server, never from the browser directly.
//
// No slug, or the branding lookup fails: fall back to the generic manifest
// (same shape as the static /manifest.json) rather than erroring, so the
// page is always installable.

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxhr8PmMAoxFM_zeheygEmEg4avaHa6uaVlkUGweqv265PM5LDFwwYzlIL7svfSxGlq/exec';

const ICONS = [
  { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

function baseManifest() {
  return {
    name: 'Zera PMS — Dental Patient Management',
    short_name: 'Zera PMS',
    description: 'Patient and case tracking for dental clinics — every treatment, enquiry to recall, on one board.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0B1F33',
    theme_color: '#0B1F33',
    icons: ICONS,
  };
}

// Manifest short_name renders under the home-screen icon; keep it tight so
// it doesn't wrap/truncate oddly on a phone's home screen grid.
function toShortName(clinicName) {
  var trimmed = String(clinicName || '').trim();
  if (!trimmed) return 'Zera PMS';
  if (trimmed.length <= 12) return trimmed;
  var firstWord = trimmed.split(/\s+/)[0];
  if (firstWord.length <= 12) return firstWord;
  return trimmed.slice(0, 12);
}

module.exports = async (req, res) => {
  var slug = req.query && req.query.c;
  if (Array.isArray(slug)) slug = slug[0];

  res.setHeader('Content-Type', 'application/manifest+json');
  // Cache at the edge/browser briefly — clinic names essentially never
  // change, but this keeps a renamed clinic from being stuck forever.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');

  var manifest = baseManifest();

  if (!slug || typeof slug !== 'string') {
    res.status(200).json(manifest);
    return;
  }

  try {
    var upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getClinicBranding', slug: slug }),
      redirect: 'follow',
    });
    var text = await upstream.text();
    var data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }

    if (data && data.ok && data.clinicName) {
      manifest.name = data.clinicName + ' — Zera PMS';
      manifest.short_name = toShortName(data.clinicName);
    }
  } catch (err) {
    // Branding lookup failed — ship the generic-but-still-correctly-scoped
    // manifest below rather than a 5xx, so the page stays installable.
  }

  // Always scope start_url to this clinic once we know the slug, even if
  // the branding name lookup above failed — this is the key fix: without
  // it, every installed icon reopens the slug-less root and strands the
  // client on the "which clinic?" screen instead of their dashboard.
  manifest.start_url = '/?c=' + encodeURIComponent(slug) + '&source=pwa';

  res.status(200).json(manifest);
};
