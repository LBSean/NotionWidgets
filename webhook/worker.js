/**
 * Notion Widgets — Pomodoro Webhook
 * Cloudflare Worker
 *
 * Receives a session payload from the Pomodoro widget and creates a new page
 * in your Notion database. Acts as a CORS-transparent proxy so the browser
 * can reach the Notion API without restriction.
 *
 * Required secrets (set via CLI — never hardcode here):
 *   wrangler secret put NOTION_TOKEN    ← your integration's Internal Integration Secret
 *   wrangler secret put NOTION_DB_ID    ← the 32-char ID of your Notion database
 *
 * Expected Notion database schema:
 *   Name           (Title)
 *   Date           (Date)
 *   Duration (min) (Number)
 *   Type           (Select  — option: "Work")
 *   Completed At   (Rich Text)
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {

    // ── CORS preflight ──────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
      return reply({ error: 'POST only' }, 405);
    }

    // ── Parse body ──────────────────────────────────────────────
    let data;
    try {
      data = await request.json();
    } catch {
      return reply({ error: 'Invalid JSON body' }, 400);
    }

    // ── Guard: secrets must be set ──────────────────────────────
    if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) {
      return reply({
        error: 'Worker not configured — run: wrangler secret put NOTION_TOKEN  and  wrangler secret put NOTION_DB_ID',
      }, 500);
    }

    // ── Build Notion page ───────────────────────────────────────
    const sessionLabel = [data.label || 'Pomodoro', data.session ? `#${data.session}` : '']
      .filter(Boolean).join(' — ');

    const page = {
      parent: { database_id: env.NOTION_DB_ID },
      properties: {
        'Name': {
          title: [{ text: { content: sessionLabel } }],
        },
        'Date': {
          date: { start: data.date || new Date().toISOString().slice(0, 10) },
        },
        'Duration (min)': {
          number: typeof data.duration === 'number' ? data.duration : 25,
        },
        'Type': {
          select: { name: data.type || 'Work' },
        },
        'Completed At': {
          rich_text: [{ text: { content: data.completedAt || '' } }],
        },
      },
    };

    // ── Call Notion API ─────────────────────────────────────────
    let notionRes;
    try {
      notionRes = await fetch('https://api.notion.com/v1/pages', {
        method:  'POST',
        headers: {
          'Authorization':  `Bearer ${env.NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type':   'application/json',
        },
        body: JSON.stringify(page),
      });
    } catch (err) {
      return reply({ error: 'Failed to reach Notion API', message: err.message }, 502);
    }

    const result = await notionRes.json();

    if (!notionRes.ok) {
      // Surface Notion's error message to make debugging easy
      return reply({
        error:   'Notion API error',
        code:    result.code,
        message: result.message,
      }, notionRes.status);
    }

    return reply({ ok: true, page_id: result.id });
  },
};

// ── Helper ──────────────────────────────────────────────────────
function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
