# Invoice Scanner — Hosting Guide

This turns the invoice scanner into a real public website anyone can open,
take a photo in, and see it land in a shared log. It costs $0 to host on the
free tiers below (you only pay Anthropic for the actual API calls — a few
cents per scan).

## What you need first

1. **An Anthropic API key** — console.anthropic.com → API Keys → Create Key.
   Keep it secret; it goes in an environment variable, never in the page.
2. **A free Supabase project** (supabase.com) — this is the database that
   replaces the old in-artifact storage.
3. **A free Vercel account** (vercel.com) — this hosts the site and runs the
   two small server functions in `/api`.
4. **A GitHub account** (or the Vercel CLI) to push this folder.

## Step 1 — Create the database table

In your Supabase project: SQL Editor → New Query → paste and run:

```sql
create table invoices (
  id text primary key,
  vendor text,
  invoice text,
  date text,
  due text,
  billto text,
  jobsite text,
  city text,
  state text,
  category text,
  status text,
  items text,
  subtotal numeric,
  tax numeric,
  fees numeric,
  total numeric,
  notes text,
  created_at timestamp default now()
);

-- allow the service role key (server-side only) full access;
-- keep row level security ON so no one can hit the table directly
-- with the public anon key.
alter table invoices enable row level security;
```

If you created the table earlier without the `items` column, add it:

```sql
alter table invoices add column if not exists items text;
```

Then go to **Project Settings → API** and copy:
- `Project URL` → this is `SUPABASE_URL`
- `service_role` key (NOT the `anon` key) → this is `SUPABASE_SERVICE_KEY`

The service key only ever lives in your server function's environment
variables, never in the browser — that's what row-level security is
protecting against.

## Step 2 — Push this folder to GitHub

```bash
cd invoice-scanner
git init
git add .
git commit -m "Invoice scanner"
git branch -M main
git remote add origin https://github.com/<you>/invoice-scanner.git
git push -u origin main
```

(Or skip GitHub and run `vercel` from inside this folder with the Vercel CLI
installed — it'll deploy directly.)

## Step 3 — Deploy on Vercel

1. vercel.com → **Add New Project** → import the GitHub repo.
2. Framework preset: **Other** (no build step needed — it's static + functions).
3. Before deploying, open **Environment Variables** and add:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `APP_ACCESS_KEY` — a long random password (see Security below)
4. Deploy. Vercel gives you a URL like `invoice-scanner.vercel.app` —
   that's your public link. Open it on a phone, enter the access key when
   asked, and tap "Take Photo".

## Step 4 — (Optional) custom domain

Vercel → Project → Settings → Domains → add a domain you own and follow
the DNS instructions it gives you.

## Security

- **Set `APP_ACCESS_KEY`.** When it is set, every API call must include it, and
  the page asks for it once per browser tab. When it is NOT set, anyone with the
  link can add, view, and delete records and spend your Anthropic credits, and the
  server writes a warning to the logs. Generate a key with `openssl rand -base64 32`.
- **Anthropic usage costs money per API call** — each photo scan is one small
  vision request, typically a fraction of a cent. The access key is the main cost
  control. For heavier exposure, also add rate limiting (for example Vercel's
  Firewall rate-limit rules) and set a monthly spend limit in the Anthropic console.
- **The Supabase service key bypasses row-level security.** It must stay in
  server environment variables only. `api/records.js` validates every field and id
  before writing, because it is the only gatekeeper for the table.
- Uploaded photos are sent to Anthropic for reading and are not stored by this app.
- Supabase's free tier comfortably handles thousands of invoice rows.

## Files in this project

```
api/
  extract.js   — server function: receives a photo, calls Anthropic, returns parsed fields
  records.js   — server function: list / create / delete invoice rows in Supabase
lib/
  auth.js      — shared access-key check used by both server functions
public/
  index.html   — the whole frontend (camera capture, review form, log table)
.env.example   — template for the four secrets above
```
