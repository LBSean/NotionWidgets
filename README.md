# Notion Widgets

Free, open-source embeddable widgets for Notion. Fork this repo and deploy your own — no shared infrastructure, no accounts needed, no limits.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LBSean/NotionWidgets)

---

## Widgets

| Widget | Description | Sync? |
|--------|-------------|:-----:|
| Clock | Live time & date | No |
| Pomodoro | 25/5 focus timer with Notion logging | Yes |
| Ambient Sounds | Rain, thunder, jungle, coffee, snow, lofi | No |
| Heatmap | Multi-category habit tracker with heatmap | Yes |
| Weather | Current conditions + forecast | Optional |
| News | RSS/Atom feed reader | Optional |
| Sticky Note | Multi-tab scratch pad | Optional |
| Countdown | Count down to / up from any date | Optional |
| Priority Matrix | Eisenhower 2x2 drag-and-drop | Optional |
| Chore Rotation | Recurring tasks sorted by urgency | Optional |
| Grocery List | Shopping checklist with check-off | Optional |
| Meal Planner | Weekly breakfast/lunch/dinner grid | Optional |
| Sleep Log | Bedtime & wake tracker with bar chart | Optional |

> **All widgets work standalone** — data is saved to localStorage. The Cloudflare Worker is only needed to sync data across devices via Notion.

---

## Quick Start (no sync)

1. **Fork** this repo
2. **Deploy** — click the Vercel button above, or enable GitHub Pages (Settings → Pages → Source: GitHub Actions)
3. **Embed** — type `/embed` in Notion, paste your widget URL:
   ```
   https://your-domain.vercel.app/widgets/clock/
   ```

That's it. All widgets work immediately without any backend.

---

## Full Setup with Notion Sync

If you want cross-device sync, follow these 4 steps (about 15 minutes).

### Step 1: Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration**
2. Name it (e.g. "My Widgets"), select your workspace, click **Submit**
3. Copy the **Internal Integration Secret** (starts with `ntn_`)
4. Create a blank page in Notion where the databases will live
5. On that page, click **⋯ → Connections → Add** your integration

### Step 2: Create the Databases (automated)

```bash
npm install
npm run setup
```

The script will:
- Prompt for your integration token and the parent page ID
- Create all 4 databases with the correct schemas
- Print the database IDs and ready-to-paste wrangler commands

> **Finding your page ID:** Open the page in Notion, copy the URL. The 32-character hex string at the end is the page ID.
> Example: `https://notion.so/My-Widgets-abc123def456...` → `abc123def456...`

<details>
<summary><strong>Manual alternative</strong> — create databases by hand</summary>

Create 4 databases under your Notion page with these exact property names:

**Pomodoro Sessions**
| Property | Type |
|----------|------|
| Name | Title |
| Date | Date |
| Duration (min) | Text |
| Type | Text |

**Habit Tracker**
| Property | Type |
|----------|------|
| Day | Title |
| Date | Date |
| Data | Text |
| Summary | Text |

**Widget Data**
| Property | Type |
|----------|------|
| Key | Title |
| Data | Text |

**Sticky Notes**
| Property | Type |
|----------|------|
| NoteId | Title |
| Title | Text |
| Content | Text |
| Archived | Checkbox |

After creating each database, open it in a browser and copy the 32-character hex ID from the URL.

</details>

### Step 3: Deploy the Cloudflare Worker

```bash
# Install Wrangler CLI (one-time)
npm install -g wrangler

# Login to Cloudflare (opens browser, free account is fine)
wrangler login

# Set secrets (the setup script prints these commands with your values)
cd webhook
wrangler secret put NOTION_TOKEN
wrangler secret put NOTION_DB_ID
wrangler secret put NOTION_HABITS_DB_ID
wrangler secret put NOTION_WIDGET_DATA_DB_ID
wrangler secret put NOTION_STICKY_DB_ID

# Deploy
wrangler deploy
```

Copy the worker URL from the output — it looks like:
```
https://notion-widgets-webhook.<your-subdomain>.workers.dev
```

> **Tip:** You can also use `npx wrangler` instead of installing globally.

### Step 4: Connect Your Widgets

Open any widget → **⚙ Settings** → paste your Worker URL → **Test** → **Save**.

Each widget stores the worker URL independently, so you only need to set it once per widget.

---

## Architecture

```
Notion Page
  └── /embed widget URL
        ↓
  Static HTML Widget (Vercel / GitHub Pages / Cloudflare Pages)
        │
        │ POST { action, key, data }  (optional — only if sync is configured)
        ↓
  Cloudflare Worker (CORS proxy)
        │
        │ Notion API
        ↓
  Your Notion Databases
```

- **Frontend:** Pure HTML/CSS/JS — no frameworks, no build step
- **Backend:** Cloudflare Worker acts as a CORS proxy to the Notion API
- **Storage:** Notion databases (one per widget type)
- **Offline-first:** localStorage is the primary store; Notion is the sync layer

---

## Local Development

```bash
npm install
npm run dev       # opens gallery at localhost:3000
```

To test the worker locally:

```bash
cd webhook
cp .env.example .env   # fill in your secrets
npx wrangler dev       # starts worker at localhost:8787
```

---

## Adding a Widget

1. Copy the template:
   ```bash
   cp -r widgets/_template widgets/my-widget
   ```
2. Edit `widgets/my-widget/index.html` — use `../../shared/base.css` for resets and CSS variables
3. Register in the gallery — add to the `WIDGETS` array in `index.html`:
   ```js
   { slug: 'my-widget', name: 'My Widget', desc: 'What it does' },
   ```
4. Push to main — auto-deploys

---

## Hosting Options

| Option | Free? | Private repos? | Setup |
|--------|:-----:|:--------------:|-------|
| **Vercel** | Yes | Yes | Click deploy button above |
| **GitHub Pages** | Yes | Needs Pro | Settings → Pages → GitHub Actions |
| **Cloudflare Pages** | Yes | Yes | Connect repo, output = `/` |

All three serve static files — pick whichever you prefer.

---

## Project Structure

```
NotionWidgets/
├── .github/workflows/deploy.yml    ← GitHub Pages auto-deploy
├── scripts/setup-notion.js         ← Automated database setup
├── webhook/
│   ├── worker.js                   ← Cloudflare Worker (Notion proxy)
│   ├── wrangler.toml               ← Worker config
│   └── .env.example                ← Secret template for local dev
├── widgets/
│   ├── _template/                  ← Copy to start a new widget
│   ├── clock/
│   ├── pomodoro/
│   ├── ambient/
│   ├── heatmap/
│   ├── weather/
│   ├── news/
│   ├── sticky/
│   ├── countdown/
│   ├── matrix/
│   ├── chores/
│   ├── grocery/
│   ├── meals/
│   └── sleep/
├── shared/
│   ├── base.css                    ← Shared resets + CSS variables
│   └── theme.js                    ← Light/dark theme toggle
├── index.html                      ← Widget gallery
├── vercel.json                     ← Vercel deploy config
├── package.json
└── LICENSE                         ← MIT
```

---

## License

MIT — see [LICENSE](LICENSE)
