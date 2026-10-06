// ExtracTerre v2.3.1 — relais IA côté serveur : les clés restent dans les secrets Supabase,
// jamais dans le navigateur. Accès réservé aux comptes Cloud ExtracTerre connectés.
// Fournisseurs : ChatGPT (OpenAI), Gemini (Google), Claude (Anthropic).
// Déploiement :
//   supabase secrets set OPENAI_API_KEY=...        (ChatGPT)
//   supabase secrets set GEMINI_API_KEY=...        (Gemini)
//   supabase secrets set ANTHROPIC_API_KEY=...     (Claude, optionnel)
//   supabase secrets set EXTRACTERRE_LLM_MODELS="gpt-5.4-mini,gemini-3.5-flash"   (liste blanche, optionnelle)
//   supabase functions deploy extracterre-llm-extract
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
const DEFAULT_MODELS: Record<string, string> = { openai: "gpt-5.4-mini", gemini: "gemini-3.5-flash", anthropic: "claude-sonnet-5-5" }
const KEY_ENV: Record<string, string> = { openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", anthropic: "ANTHROPIC_API_KEY" }
const ALLOWED_MODELS = (Deno.env.get("EXTRACTERRE_LLM_MODELS") || "").split(",").map((s) => s.trim()).filter(Boolean)
const MAX_INPUT_CHARS = 90_000

function buildCall(provider: string, model: string, system: string, user: string, key: string) {
  if (provider === "openai") return {
    url: "https://api.openai.com/v1/chat/completions",
    init: { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_completion_tokens: 2000, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) },
  }
  if (provider === "gemini") return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    init: { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2000, temperature: 0 } }) },
  }
  return {
    url: "https://api.anthropic.com/v1/messages",
    init: { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: "user", content: user }] }) },
  }
}
// deno-lint-ignore no-explicit-any
function readText(provider: string, data: any) {
  if (provider === "openai") return { text: String(data?.choices?.[0]?.message?.content || ""), usage: data?.usage || null }
  // deno-lint-ignore no-explicit-any
  if (provider === "gemini") return { text: (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("\n"), usage: data?.usageMetadata || null }
  // deno-lint-ignore no-explicit-any
  return { text: (data?.content || []).map((c: any) => c.type === "text" ? c.text : "").join("\n"), usage: data?.usage || null }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Utilisateur non authentifie" }, 401)
    const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user }, error: userError } = await auth.auth.getUser(authHeader.slice(7).trim())
    if (userError || !user) return json({ error: "Session invalide ou expiree" }, 401)

    const body = await req.json()
    const provider = String(body?.provider || "openai")
    if (!KEY_ENV[provider]) return json({ error: `Fournisseur inconnu : ${provider}` }, 400)
    const key = Deno.env.get(KEY_ENV[provider])
    if (!key) return json({ error: `${KEY_ENV[provider]} non configuree sur le serveur` }, 500)
    const model = String(body?.model || DEFAULT_MODELS[provider])
    if (ALLOWED_MODELS.length && !ALLOWED_MODELS.includes(model)) return json({ error: `Modele non autorise : ${model}` }, 400)
    const system = String(body?.system || "").slice(0, 4000)
    const user0 = String(body?.messages?.[0]?.content || "")
    if (!user0 || user0.length > MAX_INPUT_CHARS) return json({ error: "Requete vide ou trop volumineuse" }, 413)

    const { url, init } = buildCall(provider, model, system, user0, key)
    const res = await fetch(url, init)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return json({ error: data?.error?.message || `Erreur API ${provider} ${res.status}` }, 502)
    const out = readText(provider, data)
    console.log(JSON.stringify({ event: "llm_extract", user: user.id, provider, model, inputChars: user0.length, usage: out.usage }))
    return json(out)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
