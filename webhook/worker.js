/**
 * Notion Widgets — Webhook Worker
 * Cloudflare Worker
 *
 * Routes requests by `action` field in the POST body:
 *   (default / "pomodoro")  → Creates a Pomodoro session page in Notion
 *   "habits-sync"           → Reads habit data from Notion for a given year
 *   "habits-save"           → Upserts a day's habit data to Notion
 *
 * Required secrets (set via CLI — never hardcode here):
 *   wrangler secret put NOTION_TOKEN          ← Integration Secret
 *   wrangler secret put NOTION_DB_ID          ← Pomodoro database ID
 *   wrangler secret put NOTION_HABITS_DB_ID   ← Habit Tracker database ID
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

    // ── Route by action ─────────────────────────────────────────
    const action = data.action || 'pomodoro';

    if (action === 'pomodoro')     return handlePomodoro(data, env);
    if (action === 'habits-sync')  return handleHabitsSync(data, env);
    if (action === 'habits-save')  return handleHabitsSave(data, env);

    return reply({ error: `Unknown action: ${action}` }, 400);
  },
};

// ── Pomodoro handler (original logic) ────────────────────────────
async function handlePomodoro(data, env) {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) {
    return reply({
      error: 'Worker not configured — run: wrangler secret put NOTION_TOKEN  and  wrangler secret put NOTION_DB_ID',
    }, 500);
  }

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
        rich_text: [{ text: { content: String(typeof data.duration === 'number' ? data.duration : 25) } }],
      },
      'Type': {
        rich_text: [{ text: { content: data.type || 'Work' } }],
      },
    },
  };

  let notionRes;
  try {
    notionRes = await fetch('https://api.notion.com/v1/pages', {
      method:  'POST',
      headers: notionHeaders(env),
      body: JSON.stringify(page),
    });
  } catch (err) {
    return reply({ error: 'Failed to reach Notion API', message: err.message }, 502);
  }

  const result = await notionRes.json();

  if (!notionRes.ok) {
    return reply({
      error:   'Notion API error',
      code:    result.code,
      message: result.message,
    }, notionRes.status);
  }

  return reply({ ok: true, page_id: result.id });
}

// ── Habits sync: read all entries for a year ─────────────────────
async function handleHabitsSync(data, env) {
  if (!env.NOTION_TOKEN || !env.NOTION_HABITS_DB_ID) {
    return reply({
      error: 'Habits DB not configured — run: wrangler secret put NOTION_HABITS_DB_ID',
    }, 500);
  }

  const year = data.year;
  if (!year || typeof year !== 'number') {
    return reply({ error: 'Missing or invalid "year" parameter' }, 400);
  }

  const startDate = `${year}-01-01`;
  const endDate   = `${year + 1}-01-01`;

  let allPages = [];
  let cursor = undefined;
  let iterations = 0;

  // Paginate (Notion returns max 100 per query, year has ≤366 days)
  do {
    const queryBody = {
      filter: {
        and: [
          { property: 'Date', date: { on_or_after: startDate } },
          { property: 'Date', date: { before: endDate } },
        ],
      },
      page_size: 100,
    };
    if (cursor) queryBody.start_cursor = cursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${env.NOTION_HABITS_DB_ID}/query`,
      { method: 'POST', headers: notionHeaders(env), body: JSON.stringify(queryBody) },
    );

    if (!res.ok) {
      const err = await res.json();
      return reply({ error: 'Notion query failed', message: err.message }, res.status);
    }

    const result = await res.json();
    allPages = allPages.concat(result.results);
    cursor = result.has_more ? result.next_cursor : undefined;
    iterations++;
  } while (cursor && iterations < 5);

  // Parse pages into { "2026-03-01": { "c_health": 100, ... }, ... }
  const entries = {};
  for (const page of allPages) {
    const title   = page.properties.Day?.title?.[0]?.plain_text;
    const dataStr = page.properties.Data?.rich_text?.[0]?.plain_text;
    if (title && dataStr) {
      try { entries[title] = JSON.parse(dataStr); } catch { /* skip malformed */ }
    }
  }

  return reply({ ok: true, entries });
}

// ── Habits save: upsert a single day ─────────────────────────────
async function handleHabitsSave(data, env) {
  if (!env.NOTION_TOKEN || !env.NOTION_HABITS_DB_ID) {
    return reply({ error: 'Habits DB not configured' }, 500);
  }

  const { date, data: dayData, summary } = data;
  if (!date || !dayData) {
    return reply({ error: 'Missing "date" or "data"' }, 400);
  }

  const headers = notionHeaders(env);

  // Step 1: Query for existing page with this Day title
  const queryRes = await fetch(
    `https://api.notion.com/v1/databases/${env.NOTION_HABITS_DB_ID}/query`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: { property: 'Day', title: { equals: date } },
        page_size: 1,
      }),
    },
  );

  if (!queryRes.ok) {
    const err = await queryRes.json();
    return reply({ error: 'Notion query failed', message: err.message }, queryRes.status);
  }

  const queryResult = await queryRes.json();
  const existingPage = queryResult.results[0];

  const properties = {
    'Day':     { title:     [{ text: { content: date } }] },
    'Date':    { date:      { start: date } },
    'Data':    { rich_text: [{ text: { content: JSON.stringify(dayData) } }] },
    'Summary': { rich_text: [{ text: { content: summary || '' } }] },
  };

  let notionRes;

  if (existingPage) {
    // Update existing page
    notionRes = await fetch(`https://api.notion.com/v1/pages/${existingPage.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ properties }),
    });
  } else {
    // Skip creation if all habits are unchecked (empty data)
    if (Object.keys(dayData).length === 0) {
      return reply({ ok: true, action: 'skipped', reason: 'empty data, no page to create' });
    }
    // Create new page
    notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers,
      body: JSON.stringify({ parent: { database_id: env.NOTION_HABITS_DB_ID }, properties }),
    });
  }

  if (!notionRes.ok) {
    const err = await notionRes.json();
    return reply({ error: 'Notion API error', code: err.code, message: err.message }, notionRes.status);
  }

  const result = await notionRes.json();
  return reply({ ok: true, page_id: result.id, action: existingPage ? 'updated' : 'created' });
}

// ── Helpers ──────────────────────────────────────────────────────
function notionHeaders(env) {
  return {
    'Authorization':  `Bearer ${env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type':   'application/json',
  };
}

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
