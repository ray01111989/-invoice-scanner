// GET    /api/records            -> list all invoices
// POST   /api/records            -> create one (body = record JSON)
// DELETE /api/records?id=<id>    -> delete one
//
// Uses the Supabase service key, which bypasses row-level security. That makes this file the
// only gatekeeper for the table, so it checks access and validates every field itself.
import { requireAccess } from '../lib/auth.js';

// Strip any trailing slash so we never end up with a doubled-up path like
// ".../rest/v1/rest/v1/invoices" if the env var was pasted with one.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Record ids are created by the page as "id_<timestamp>_<random>"; nothing else is accepted.
const RECORD_ID_PATTERN = /^id_\d{10,16}_[a-z0-9]{1,10}$/;
// Looser check for deletes, so older records with a different id shape can still be removed.
const DELETE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// Dates are either empty or YYYY-MM-DD.
const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})?$/;
// The most rows the list call will return.
const MAX_LIST_ROWS = 2000;

// Text columns and the longest value each may hold.
const TEXT_FIELDS = {
  vendor: 200, invoice: 100, billto: 200, jobsite: 200, city: 100,
  state: 50, category: 60, items: 2000, notes: 500,
};
// Money columns.
const NUMBER_FIELDS = ['subtotal', 'tax', 'fees', 'total'];

// Headers Supabase needs on every call.
function headers() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Turn the request body into a clean record, or return null if it is not acceptable.
// Only known columns are copied across, so a caller cannot write anything else to the table.
function validateRecord(body) {
  // The body must be a plain object.
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  // The id must match the exact format the page generates.
  if (typeof body.id !== 'string' || !RECORD_ID_PATTERN.test(body.id)) return null;

  const record = { id: body.id };

  // Text columns: must be strings (or absent) and within their length limit.
  for (const [key, maxLength] of Object.entries(TEXT_FIELDS)) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > maxLength) return null;
    record[key] = value;
  }

  // Date columns: empty or YYYY-MM-DD.
  for (const key of ['date', 'due']) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null;
    record[key] = value;
  }

  // Money columns: finite numbers only.
  for (const key of NUMBER_FIELDS) {
    const value = Number(body[key] ?? 0);
    if (!Number.isFinite(value)) return null;
    record[key] = value;
  }

  // Status is either Paid or Unpaid.
  record.status = body.status === 'Paid' ? 'Paid' : 'Unpaid';
  return record;
}

export default async function handler(req, res) {
  // Stop here (with a 401) if an access key is required and missing.
  if (!requireAccess(req, res)) return;

  // The database settings come from Vercel environment variables.
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_KEY is not set in this deployment');
    return res.status(500).json({ error: 'Server is not configured' });
  }

  try {
    // ---- List ----
    if (req.method === 'GET') {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?select=*&order=date.desc&limit=${MAX_LIST_ROWS}`,
        { headers: headers() }
      );
      const data = await r.json();
      if (!r.ok || !Array.isArray(data)) {
        console.error('Supabase list failed', r.status, data);
        return res.status(502).json({ error: 'Could not load records' });
      }
      return res.status(200).json(data);
    }

    // ---- Create ----
    if (req.method === 'POST') {
      // Validate first; an invalid record never reaches the database.
      const record = validateRecord(req.body);
      if (!record) return res.status(400).json({ error: 'Invalid record' });

      const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, {
        method: 'POST',
        headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify(record),
      });
      const data = await r.json();
      if (!r.ok) {
        console.error('Supabase insert failed', r.status, data);
        return res.status(502).json({ error: 'Could not save the record' });
      }
      return res.status(201).json(data);
    }

    // ---- Delete ----
    if (req.method === 'DELETE') {
      const { id } = req.query;
      // The id must be a single, plainly formatted string.
      if (typeof id !== 'string' || !DELETE_ID_PATTERN.test(id)) {
        return res.status(400).json({ error: 'Invalid id' });
      }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!r.ok) {
        console.error('Supabase delete failed', r.status, await r.text());
        return res.status(502).json({ error: 'Could not delete the record' });
      }
      return res.status(200).json({ ok: true });
    }

    // Any other HTTP method is not supported.
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    // Keep the detail in the logs; return a generic message.
    console.error('Records request failed:', err);
    return res.status(500).json({ error: 'Records request failed' });
  }
}
