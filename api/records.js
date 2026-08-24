// GET    /api/records            -> list all invoices
// POST   /api/records             -> create one (body = record JSON)
// DELETE /api/records?id=<id>     -> delete one
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?select=*&order=date.desc`,
        { headers: headers() }
      );
      const data = await r.json();
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
      return res.status(201).json(data);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Missing id" });
      await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: headers(),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Records request failed", detail: String(err) });
  }
}
