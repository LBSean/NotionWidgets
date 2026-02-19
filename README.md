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
npm run dev          # opens gallery at http://localhost:3000/gallery.html
```

The gallery auto-reloads on every file save and previews every widget in a card with a one-click "Copy URL" button.

---

## Adding a new widget

1. **Copy the template**
   ```bash
   cp -r widgets/_template widgets/my-widget
   ```

2. **Build it** — edit `widgets/my-widget/index.html`. Use `../../shared/base.css` for consistent resets and CSS variables.

3. **Register it in the gallery** — open `gallery.html` and add an entry to the `WIDGETS` array:
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
├── .github/
│   └── workflows/
│       └── deploy.yml          ← auto-deploys on push to main
├── widgets/
│   ├── _template/
│   │   └── index.html          ← copy this to start a new widget
│   └── clock/
│       └── index.html          ← sample widget
├── shared/
│   └── base.css                ← Notion-friendly resets + CSS variables
├── gallery.html                ← local dev dashboard
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

## Widget checklist

| Widget | Status | Notion URL |
|--------|--------|------------|
| Clock  | ✅     | `…/widgets/clock/` |

