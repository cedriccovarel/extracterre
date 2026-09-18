import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
const CHUNK_SIZE = 45 * 1024 * 1024
const MAX_TOTAL = 700 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Utilisateur non authentifie" }, 401)
    const jwt = authHeader.slice(7).trim()
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user }, error: userError } = await auth.auth.getUser(jwt)
    if (userError || !user) return json({ error: "Session invalide ou expiree" }, 401)

    const body = await req.json()
    const originalFilename = String(body.originalFilename || "").trim()
    const fileSize = Number(body.fileSize || 0)
    const options = body.options && typeof body.options === "object" ? body.options : {}
    if (!originalFilename || !originalFilename.toLowerCase().endsWith(".pdf")) return json({ error: "Seuls les PDF sont acceptes par le worker Cloud" }, 400)
    if (!Number.isFinite(fileSize) || fileSize <= 0) return json({ error: "Taille de fichier invalide" }, 400)
    if (fileSize > MAX_TOTAL) return json({ error: `PDF superieur au plafond Cloud v2.1 (${Math.round(MAX_TOTAL / 1024 / 1024)} Mo)` }, 413)

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })

    // Nettoyage opportuniste : évite qu'un index abandonné par un navigateur fermé
    // consomme durablement le quota gratuit. On ne touche qu'aux jobs de cet utilisateur
    // âgés de plus de 24 h et non déjà nettoyés.
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: stale } = await admin.from("extracterre_jobs")
        .select("id,storage_path,storage_parts,result_storage_path")
        .eq("user_id", user.id).is("cleaned_at", null).lt("created_at", cutoff).limit(20)
      for (const old of stale || []) {
        const paths = new Set<string>()
        if (old.result_storage_path) paths.add(String(old.result_storage_path))
        if (Array.isArray(old.storage_parts)) for (const part of old.storage_parts) if (part?.path) paths.add(String(part.path))
        else if (old.storage_path) paths.add(String(old.storage_path))
        if (paths.size) await admin.storage.from("extracterre-temp").remove([...paths])
        await admin.from("extracterre_jobs").update({ cleaned_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", old.id)
      }
    } catch (cleanupError) { console.warn("Nettoyage opportuniste ignoré", cleanupError) }
    const { data: job, error: jobError } = await admin.from("extracterre_jobs").insert({
      user_id: user.id,
      status: "waiting",
      original_filename: originalFilename,
      file_size: fileSize,
      options,
    }).select("id,status,created_at").single()
    if (jobError) throw jobError

    const safeName = originalFilename.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150)
    const count = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE))
    const parts: Array<{ path: string; start: number; end: number; size: number }> = []
    for (let i = 0; i < count; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(fileSize, start + CHUNK_SIZE)
      const name = count === 1 ? safeName : `part-${String(i + 1).padStart(4, "0")}.bin`
      parts.push({ path: `${user.id}/${job.id}/input/${name}`, start, end, size: end - start })
    }
    const { error: updateError } = await admin.from("extracterre_jobs").update({ storage_path: parts[0].path, storage_parts: parts }).eq("id", job.id)
    if (updateError) throw updateError

    const signedParts = []
    for (const part of parts) {
      const { data, error } = await admin.storage.from("extracterre-temp").createSignedUploadUrl(part.path)
      if (error || !data?.token) throw error || new Error("Autorisation upload impossible")
      signedParts.push({ ...part, token: data.token })
    }
    return json({ ok: true, job: { id: job.id, status: job.status, createdAt: job.created_at }, upload: { parts: signedParts, ...(signedParts.length === 1 ? signedParts[0] : {}) } })
  } catch (error) {
    console.error(error)
    return json({ ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" }, 500)
  }
})
