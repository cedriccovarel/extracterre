import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

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
    const { jobId = "" } = await req.json()
    if (!jobId) return json({ error: "jobId manquant" }, 400)
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: job, error } = await admin.from("extracterre_jobs").select("*").eq("id", jobId).single()
    if (error || !job) return json({ error: "Job introuvable" }, 404)
    const owned = job.user_id ? job.user_id === user.id : String(job.storage_path || "").startsWith(`${user.id}/`)
    if (!owned) return json({ error: "Job non autorise" }, 403)
    if (["queued", "processing"].includes(job.status)) return json({ ok: true, alreadyStarted: true, jobId, status: job.status })
    if (job.status === "completed") return json({ ok: true, alreadyCompleted: true, jobId, status: job.status })

    const parts = Array.isArray(job.storage_parts) && job.storage_parts.length ? job.storage_parts : [{ path: job.storage_path }]
    for (const part of parts) {
      const path = String(part.path || "")
      const segments = path.split("/"); const filename = segments.pop(); const folder = segments.join("/")
      if (!filename) return json({ error: "Chemin Storage invalide" }, 400)
      const { data: files, error: listError } = await admin.storage.from("extracterre-temp").list(folder, { limit: 1000, search: filename })
      if (listError) throw listError
      if (!(files || []).some((f) => f.name === filename)) return json({ error: `Le PDF n'est pas encore complet dans Storage (${filename})` }, 409)
    }

    const token = Deno.env.get("GITHUB_WORKER_TOKEN")
    const owner = Deno.env.get("GITHUB_WORKER_OWNER")
    const repo = Deno.env.get("GITHUB_WORKER_REPO")
    if (!token || !owner || !repo) throw new Error("Configuration GitHub incomplete")
    const githubUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/run-extracterre-job.yml/dispatches`
    const githubResponse = await fetch(githubUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { job_id: String(jobId) } }),
    })
    if (![200, 204].includes(githubResponse.status)) {
      const text = await githubResponse.text()
      await admin.from("extracterre_jobs").update({ status: "error", error_message: `GitHub ${githubResponse.status}: ${text.slice(0, 2000)}`, updated_at: new Date().toISOString() }).eq("id", jobId)
      return json({ error: "Impossible de lancer GitHub", githubStatus: githubResponse.status }, 502)
    }
    await admin.from("extracterre_jobs").update({ status: "queued", error_message: null, updated_at: new Date().toISOString() }).eq("id", jobId)
    return json({ ok: true, jobId, status: "queued" })
  } catch (error) {
    console.error(error)
    return json({ ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" }, 500)
  }
})
