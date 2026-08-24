// POST /api/extract
// Body: { base64: "<image bytes, no data: prefix>", mediaType: "image/jpeg" }
// Returns: parsed invoice fields as JSON
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { base64, mediaType } = req.body || {};
  if (!base64 || !mediaType) {
    return res.status(400).json({ error: "Missing base64 or mediaType" });
  }

  const prompt = `You are extracting structured data from a photo of an invoice or receipt.
Return ONLY a raw JSON object, no markdown fences, no preamble, with exactly these keys:
vendor, invoice_number, invoice_date, due_date, bill_to, job_site, city, state, category,
subtotal, tax, fees, total, status, notes.

Rules:
- Dates as YYYY-MM-DD if determinable, else best guess, else empty string.
- Money fields as plain numbers (no $ signs), 0 if not present.
- "category" should be a short 1-3 word guess (e.g. "Supplies", "Job Invoice", "Equipment", "Utility").
- "status" should be "Paid" if there's clear evidence of payment, otherwise "Unpaid".
- "notes" is a short (<15 words) description of line items / job description.
- If a field truly cannot be determined, use an empty string ("") or 0 for numbers. Never omit a key.`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(502).json({ error: "Anthropic API error", detail: errText });
    }

    const data = await anthropicRes.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) return res.status(502).json({ error: "No text in model response" });

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: "Extraction failed", detail: String(err) });
  }
}
