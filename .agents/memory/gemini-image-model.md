---
name: Gemini image-generation model
description: Which Gemini model actually supports image output via @google/genai, and how the failure presents.
---

# Gemini image-generation model

The ONLY Gemini model that supports image *output* (responseModalities ["TEXT","IMAGE"]) with the current GEMINI_API_KEY is **`gemini-2.5-flash-image`** (verified live).

These all FAIL:
- `gemini-2.0-flash-exp-image-generation` → 404 not found (and earlier 400 "Model does not support the requested response modalities: image,text")
- `gemini-2.0-flash-preview-image-generation` → 404
- `gemini-2.5-flash-image-preview` → 404
- `gemini-2.0-flash` → no image output (text-only)

**Why:** Google deprecates/renames experimental image models frequently. A wrong model name surfaces as an opaque HTTP 500 from our endpoints (`فشلت جميع النماذج`), so the customer-facing symptom is "preview doesn't show / nothing happens" — not an obvious model error.

**How to apply:** If AI Studio Preview (`server/studio-preview.ts`) or any image generation stops producing images, first test candidate model names live with the SDK before touching prompt/gating code. Model name is stored in DB `studio_preview_settings.gemini_model` AND defaulted in code (studio-preview.ts) AND in `server/migrate.ts` — keep all in sync. To verify quickly: run a tiny `ai.models.generateContent` with `responseModalities:["TEXT","IMAGE"]` from the project root (not /tmp — module resolution).
