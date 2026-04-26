const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

app.post("/cook", async (req, res) => {
  const { dish } = req.body;
  if (!dish) return res.status(400).json({ error: "dish is required" });

  const prompt = `You are a professional chef assistant. The user wants to cook: "${dish}"

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "dish": "cleaned dish name",
  "emoji": "single relevant food emoji",
  "totalMinutes": <total cook time as integer>,
  "stages": [
    { "name": "Stage Name", "minutes": <integer>, "tip": "one short helpful tip" }
  ]
}

Rules:
- Decide the number of stages based on the dish complexity (1 stage for simple things, up to 4-5 for complex dishes)
- Each stage name should be short (2-3 words max)
- Tips should be practical and under 10 words
- totalMinutes must equal the sum of all stage minutes
- Be realistic with cook times`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 512 }
      })
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get cooking info" });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Cook Timer API running on port ${PORT}`));
