# Notion Widgets

Personal collection of embeddable HTML widgets for Notion, hosted via GitHub Pages.

## Live URL pattern

```
https://<your-username>.github.io/<repo-name>/widgets/<widget-slug>/
```

Paste any of these URLs into a Notion `/embed` block.

---

## Local development

```bash
npm install          # first time only
npm run dev          # opens gallery at http://localhost:3000
```

The gallery auto-reloads on every file save and previews every widget in a card with a one-click "Copy URL" button.

---

## Adding a new widget

1. **Copy the template**
   ```bash
   cp -r widgets/_template widgets/my-widget
   ```

2. **Build it** — edit `widgets/my-widget/index.html`. Use `../../shared/base.css` for consistent resets and CSS variables.

3. **Register it in the gallery** — open `index.html` and add an entry to the `WIDGETS` array:
   ```js
   { slug: 'my-widget', name: 'My Widget', desc: 'What it does' },
   ```

4. **Push to main** — GitHub Actions deploys automatically. Your Notion embed URL will be:
   ```
   https://<your-username>.github.io/<repo-name>/widgets/my-widget/
   ```

---

## Project structure

```
NotionWidgets/
├── .github/workflows/deploy.yml ← auto-deploys on push to main
├── webhook/
│   ├── worker.js               ← Cloudflare Worker (Pomodoro → Notion proxy)
│   └── wrangler.toml           ← Worker deployment config
├── widgets/
│   ├── _template/index.html    ← copy this to start a new widget
│   ├── clock/index.html
│   ├── pomodoro/index.html
│   ├── ambient/index.html
│   └── heatmap/index.html
├── shared/base.css             ← Notion-friendly resets + CSS variables
├── index.html                  ← widget gallery (lbsean.github.io/NotionWidgets/)
├── package.json
└── .gitignore
```

---

## One-time GitHub setup

### Option A — Public repo (simplest, free)

1. Create a **public** repo on GitHub and push this folder.
2. Go to **Settings → Pages → Source** and select **GitHub Actions**.
3. Push to `main` — the Actions workflow deploys automatically.

### Option B — Private repo (free with Cloudflare Pages)

GitHub Pages requires GitHub Pro for private repos, but Cloudflare Pages is free and supports private repos:

1. Push to a **private** GitHub repo.
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/) → Create project → Connect GitHub.
3. Select the repo, leave build settings blank (no build command, output = `/`).
4. Deploy. Your live URL will be `https://<project>.pages.dev/widgets/<slug>/`.

---

## Pomodoro → Notion logging setup

The Pomodoro widget logs each completed work session to a Notion database via a Cloudflare Worker that lives in `webhook/`. It's a one-time 10-minute setup.

### Step 1 — Create the Notion database

In Notion, create a new **full-page database** and add these properties *(exact names matter)*:

| Property name | Type |
|---|---|
| `Name` | Title (already exists) |
| `Date` | Date |
| `Duration (min)` | Number |
| `Type` | Select — add option `Work` |
| `Completed At` | Text |

### Step 2 — Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration**
2. Give it a name (e.g. *Pomodoro Logger*), select your workspace, click **Submit**
3. Copy the **Internal Integration Secret** (starts with `ntn_` or `secret_`)

Back in Notion, open the database → **⋯ menu → Connections → Connect to** → select your integration.

### Step 3 — Find your database ID

Open the database in a browser. The URL looks like:
```
https://www.notion.so/myworkspace/abcdef1234567890abcdef1234567890?v=...
```
The 32-character hex string between the last `/` and `?` is your **Database ID**.

### Step 4 — Deploy the Cloudflare Worker

```bash
# Install Wrangler CLI (one-time)
npm install -g wrangler

# Login to Cloudflare (opens browser)
wrangler login

# Set your secrets (you'll be prompted to type/paste each value)
cd webhook
wrangler secret put NOTION_TOKEN
wrangler secret put NOTION_DB_ID

# Deploy
wrangler deploy
```

Copy the worker URL from the output — it looks like:
```
https://notion-widgets-webhook.<your-subdomain>.workers.dev
```

### Step 5 — Connect the widget

1. Open the Pomodoro widget → **⚙ Settings**
2. Paste the worker URL into **Worker URL**
3. Click **Test** — you should see *✓ Success — page created in Notion*
4. Save settings

That's it. Every completed 🍅 session now appears as a new row in your Notion database.

---

## Widget checklist

Browse and copy embed URLs from the **[live gallery →](https://lbsean.github.io/NotionWidgets/)**

| Widget | Status | Notion embed URL |
|--------|--------|------------------|
| [Clock](https://lbsean.github.io/NotionWidgets/widgets/clock/) | ✅ | `https://lbsean.github.io/NotionWidgets/widgets/clock/` |
| [Pomodoro](https://lbsean.github.io/NotionWidgets/widgets/pomodoro/) | ✅ | `https://lbsean.github.io/NotionWidgets/widgets/pomodoro/` |
| [Ambient Sounds](https://lbsean.github.io/NotionWidgets/widgets/ambient/) | ✅ | `https://lbsean.github.io/NotionWidgets/widgets/ambient/` |
| [Heatmap](https://lbsean.github.io/NotionWidgets/widgets/heatmap/) | ✅ | `https://lbsean.github.io/NotionWidgets/widgets/heatmap/` |
| [Weather](https://lbsean.github.io/NotionWidgets/widgets/weather/) | ✅ | `https://lbsean.github.io/NotionWidgets/widgets/weather/` |
| [News](https://lbsean.github.io/NotionWidgets/widgets/news/) | ✅ | `https://lbsean.github.io/NotionWidgets/widgets/news/` |

