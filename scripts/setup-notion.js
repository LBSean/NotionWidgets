#!/usr/bin/env node

/**
 * NotionWidgets — Automated Database Setup
 *
 * Creates the 4 Notion databases required for widget sync:
 *   1. Pomodoro Sessions
 *   2. Habit Tracker
 *   3. Widget Data
 *   4. Sticky Notes
 *
 * Usage:
 *   npm run setup
 */

const { Client } = require('@notionhq/client');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// ── Database schemas (must match webhook/worker.js property names) ──

const DATABASES = [
  {
    name: 'Pomodoro Sessions',
    envKey: 'NOTION_DB_ID',
    properties: {
      Name:               { title: {} },
      Date:               { date: {} },
      'Duration (min)':   { rich_text: {} },
      Type:               { rich_text: {} },
    },
  },
  {
    name: 'Habit Tracker',
    envKey: 'NOTION_HABITS_DB_ID',
    properties: {
      Day:     { title: {} },
      Date:    { date: {} },
      Data:    { rich_text: {} },
      Summary: { rich_text: {} },
    },
  },
  {
    name: 'Widget Data',
    envKey: 'NOTION_WIDGET_DATA_DB_ID',
    properties: {
      Key:  { title: {} },
      Data: { rich_text: {} },
    },
  },
  {
    name: 'Sticky Notes',
    envKey: 'NOTION_STICKY_DB_ID',
    properties: {
      NoteId:   { title: {} },
      Title:    { rich_text: {} },
      Content:  { rich_text: {} },
      Archived: { checkbox: {} },
    },
  },
];

async function main() {
  console.log('\n  NotionWidgets — Database Setup\n');
  console.log('  This script creates the 4 Notion databases needed for widget sync.');
  console.log('  You will need:\n');
  console.log('    1. A Notion Integration Token (https://www.notion.so/my-integrations)');
  console.log('    2. A parent page ID where the databases will be created');
  console.log('       (Open the page in Notion, copy the 32-char hex ID from the URL)\n');

  // ── Collect inputs ──────────────────────────────────────────────

  const token = (await ask('  Notion Integration Token: ')).trim();
  if (!token) { console.log('\n  Error: Token is required.'); process.exit(1); }

  console.log('\n  To find your page ID:');
  console.log('    Open the page in Notion → copy URL → extract the 32-character hex ID.');
  console.log('    Example: https://notion.so/My-Widgets-abc123def456... → abc123def456...\n');

  let pageId = (await ask('  Parent Page ID: ')).trim();
  if (!pageId) { console.log('\n  Error: Page ID is required.'); process.exit(1); }

  // Normalize: strip dashes if the user pasted a UUID format
  pageId = pageId.replace(/-/g, '');

  // ── Verify connection ───────────────────────────────────────────

  const notion = new Client({ auth: token });

  console.log('\n  Verifying connection...');
  try {
    await notion.pages.retrieve({ page_id: pageId });
    console.log('  Connected successfully.\n');
  } catch (err) {
    if (err.code === 'object_not_found') {
      console.log('\n  Error: Page not found. Make sure:');
      console.log('    - The page ID is correct');
      console.log('    - Your integration is connected to that page');
      console.log('      (Open page → ⋯ menu → Connections → Add your integration)\n');
    } else if (err.code === 'unauthorized') {
      console.log('\n  Error: Invalid token. Check your integration secret.\n');
    } else {
      console.log(`\n  Error: ${err.message}\n`);
    }
    process.exit(1);
  }

  // ── Create databases ────────────────────────────────────────────

  const results = {};

  for (const db of DATABASES) {
    process.stdout.write(`  Creating "${db.name}"...`);
    try {
      const created = await notion.databases.create({
        parent: { page_id: pageId },
        title: [{ text: { content: db.name } }],
        properties: db.properties,
      });
      results[db.envKey] = created.id;
      console.log(` done  (${created.id})`);
    } catch (err) {
      console.log(` FAILED`);
      console.log(`    ${err.message}\n`);
      process.exit(1);
    }
  }

  // ── Print summary ───────────────────────────────────────────────

  console.log('\n  ────────────────────────────────────────────');
  console.log('  All databases created successfully!\n');

  console.log('  Database IDs:\n');
  for (const db of DATABASES) {
    console.log(`    ${db.envKey.padEnd(28)} ${results[db.envKey]}`);
  }

  // ── Print wrangler commands ─────────────────────────────────────

  console.log('\n  ────────────────────────────────────────────');
  console.log('  Next step: deploy your Cloudflare Worker.\n');
  console.log('  Run these commands from the webhook/ directory:\n');
  console.log(`    cd webhook`);

  // For the token, we don't print the actual value for security
  console.log(`    echo "${token}" | wrangler secret put NOTION_TOKEN`);
  for (const db of DATABASES) {
    console.log(`    echo "${results[db.envKey]}" | wrangler secret put ${db.envKey}`);
  }
  console.log(`    wrangler deploy`);

  // ── Offer to write .env file ────────────────────────────────────

  console.log('\n  ────────────────────────────────────────────');
  const writeEnv = (await ask('  Write webhook/.env for local development? (y/N): ')).trim().toLowerCase();

  if (writeEnv === 'y' || writeEnv === 'yes') {
    const envPath = path.join(__dirname, '..', 'webhook', '.env');
    const envContent = [
      `NOTION_TOKEN=${token}`,
      ...DATABASES.map(db => `${db.envKey}=${results[db.envKey]}`),
      '',
    ].join('\n');

    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log(`  Written to ${envPath}\n`);
    console.log('  You can now test locally with: cd webhook && wrangler dev\n');
  }

  console.log('  Remember to connect your integration to each database:');
  console.log('    Open database → ⋯ menu → Connections → Add your integration\n');
  console.log('  Setup complete!\n');

  rl.close();
}

main().catch((err) => {
  console.error(`\n  Unexpected error: ${err.message}\n`);
  rl.close();
  process.exit(1);
});
