const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Correct model name for Gemini 2.5 Flash
const GEMINI_MODEL = "gemini-2.5-flash-preview-04-17";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

function buildPrompt(dish) {
  return `You are a professional chef assistant. The user wants to cook: "${dish}"

Return ONLY valid JSON (no markdown, no explanation, no backticks) in this exact format:
{
  "dish": "cleaned dish name",
  "emoji": "single relevant food emoji",
  "totalMinutes": 10,
  "stages": [
    { "name": "Stage Name", "minutes": 10, "tip": "one short helpful tip" }
  ]
}

Rules:
- Decide the number of stages based on the dish complexity (1 stage for simple things, up to 4-5 for complex dishes)
- Each stage name should be short (2-3 words max)
- Tips should be practical and under 10 words
- totalMinutes must equal the sum of all stage minutes
- Be realistic with cook times
- Return ONLY the JSON object, nothing else`;
}

async function callGemini(dish) {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(dish) }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

app.post("/cook", async (req, res) => {
  const { dish } = req.body;
  if (!dish) return res.status(400).json({ error: "dish is required" });

  try {
    const data = await callGemini(dish);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strip any markdown fences Gemini might add despite instructions
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error("JSON parse failed. Raw text was:", text);
      return res.status(500).json({ error: "Invalid JSON from Gemini", raw: text });
    }

    res.json(parsed);
  } catch (err) {
    console.error("Cook error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint — calls Gemini and returns the raw response so you can inspect it
app.post("/debug", async (req, res) => {
  const { dish } = req.body;
  if (!dish) return res.status(400).json({ error: "dish is required" });

  try {
    const data = await callGemini(dish);
    res.json({
      model: GEMINI_MODEL,
      hasApiKey: !!GEMINI_API_KEY,
      apiKeyPrefix: GEMINI_API_KEY ? GEMINI_API_KEY.slice(0, 6) + "…" : "MISSING",
      geminiResponse: data
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      hasApiKey: !!GEMINI_API_KEY,
      apiKeyPrefix: GEMINI_API_KEY ? GEMINI_API_KEY.slice(0, 6) + "…" : "MISSING",
      model: GEMINI_MODEL
    });
  }
});

app.get("/health", (_, res) => res.json({
  ok: true,
  hasApiKey: !!GEMINI_API_KEY,
  model: GEMINI_MODEL
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Cook Timer API running on port ${PORT}`));
