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
4. Deploy. Vercel gives you a URL like `invoice-scanner.vercel.app` —
   that's your public link. Anyone who opens it on their phone can tap
   "Take Photo" and it works the same as the version I showed you.

## Step 4 — (Optional) custom domain

Vercel → Project → Settings → Domains → add a domain you own and follow
the DNS instructions it gives you.

## Notes on cost and access

- **Anyone with the link can add and see entries** — this version has no
  login. If you want it locked down, the simplest option is Vercel's
  built-in password protection (Project → Settings → Deployment Protection,
  paid tier) or I can add a simple shared-password gate to the page.
- **Anthropic usage costs money per API call** — each photo scan is one
  small vision request, typically a fraction of a cent with Claude Sonnet 5.
  There's no cap by default, so if this link goes out to many people,
  consider adding a simple rate limit or password gate so costs stay
  predictable.
- Supabase's free tier comfortably handles thousands of invoice rows.

## Files in this project

```
api/
  extract.js   — server function: receives a photo, calls Anthropic, returns parsed fields
  records.js   — server function: list / create / delete invoice rows in Supabase
public/
  index.html   — the whole frontend (camera capture, review form, log table)
.env.example   — template for the three secrets above
```
