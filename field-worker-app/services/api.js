/**
 * api.js — Civix Field Worker API Service
 * Connects the mobile app to the Civix-Pulse backend.
 */

// Point to local backend — use LAN IP so Expo Go on phone can reach it
const BASE_URL = 'http://localhost:8000';
const LOCAL_URL = 'http://localhost:8000';

let activeBase = BASE_URL;

/**
 * Attempt a request; if the primary Codespace URL fails, fall back to localhost.
 */
async function request(path, options = {}) {
  const urls = [activeBase, activeBase === BASE_URL ? LOCAL_URL : BASE_URL];

  for (const base of urls) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (res.ok) {
        activeBase = base;
        return await res.json();
      }
      // If the server responds but with an error, still return it
      const body = await res.text();
      console.warn(`[API] ${base}${path} → ${res.status}: ${body}`);
      return { error: true, status: res.status, message: body };
    } catch (err) {
      console.warn(`[API] ${base}${path} failed:`, err.message);
    }
  }
  return { error: true, status: 0, message: 'Backend unreachable' };
}

// ── Health ─────────────────────────────────────────────────────
export async function healthCheck() {
  return request('/health');
}

// ── Officer Location Ping ──────────────────────────────────────
export async function updateOfficerLocation(officerId, lat, lng) {
  return request('/api/v1/officer/update-location', {
    method: 'POST',
    body: JSON.stringify({ officer_id: officerId, lat, lng }),
  });
}

// ── Verify Resolution (Photo) ──────────────────────────────────
export async function verifyResolution(officerId, eventId, photoBase64 = null, notes = null) {
  return request('/api/v1/officer/verify-resolution', {
    method: 'POST',
    body: JSON.stringify({
      officer_id: officerId,
      event_id: eventId,
      photo_base64: photoBase64,
      notes,
    }),
  });
}

// ── Trigger Analysis (for testing swarm) ───────────────────────
export async function triggerAnalysis(eventId, description, domain, lat, lng) {
  return request('/api/v1/trigger-analysis', {
    method: 'POST',
    body: JSON.stringify({
      event_id: eventId,
      translated_description: description,
      domain,
      coordinates: { lat, lng },
    }),
  });
}

// ── Pinecone Status ────────────────────────────────────────────
export async function pineconeStatus() {
  return request('/api/v1/pinecone/status');
}
