import { createClient } from "npm:@supabase/supabase-js@2"
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Utilisateur non authentifie" }, 401)
    const jwt = authHeader.slice(7).trim(), url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user }, error: userError } = await auth.auth.getUser(jwt)
    if (userError || !user) return json({ error: "Session invalide ou expiree" }, 401)
    const { jobId = "" } = await req.json(); if (!jobId) return json({ error: "jobId manquant" }, 400)
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: job, error } = await admin.from("extracterre_jobs").select("id,user_id,status,result,error_message,result_storage_path,result_compression,created_at,started_at,completed_at,storage_path").eq("id", jobId).single()
    if (error || !job) return json({ error: "Job introuvable" }, 404)
    const owned = job.user_id ? job.user_id === user.id : String(job.storage_path || "").startsWith(`${user.id}/`)
    if (!owned) return json({ error: "Job non autorise" }, 403)
    let readUrl: string | null = null
    if (job.status === "completed" && job.result_storage_path) {
      const { data: signed, error: signedError } = await admin.storage.from("extracterre-temp").createSignedUrl(job.result_storage_path, 300)
      if (!signedError && signed?.signedUrl) readUrl = signed.signedUrl
    }
    return json({ ok: true, jobId: job.id, status: job.status, result: job.result || {}, errorMessage: job.error_message || null, readUrl, readCompression: job.result_compression || "gzip", createdAt: job.created_at, startedAt: job.started_at, completedAt: job.completed_at })
  } catch (error) { console.error(error); return json({ ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" }, 500) }
})
