// GET    /api/records            -> list all invoices
// POST   /api/records             -> create one (body = record JSON)
// DELETE /api/records?id=<id>     -> delete one

// Strip any trailing slash so we never end up with a doubled-up path like
// ".../rest/v1/rest/v1/invoices" if the env var was pasted with one.
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({
      error: "Server misconfigured",
      detail: "SUPABASE_URL or SUPABASE_SERVICE_KEY is not set in this deployment's environment variables.",
    });
  }

  try {
    if (req.method === "GET") {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?select=*&order=date.desc`,
        { headers: headers() }
      );
      const data = await r.json();
      if (!r.ok) {
        return res.status(r.status).json({ error: "Supabase list failed", detail: data });
      }
      if (!Array.isArray(data)) {
        return res.status(502).json({ error: "Unexpected Supabase response", detail: data });
      }
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const record = req.body;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, {
        method: "POST",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify(record),
      });
      const data = await r.json();
      if (!r.ok) {
        return res.status(r.status).json({ error: "Supabase insert failed", detail: data });
      }
      return res.status(201).json(data);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Missing id" });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        return res.status(r.status).json({ error: "Supabase delete failed", detail: data });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Records request failed", detail: String(err) });
  }
}
