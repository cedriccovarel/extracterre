import { createClient } from "npm:@supabase/supabase-js@2"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
const BUCKET = "extracterre-temp"

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
    const expected = Deno.env.get("EXTRACTERRE_WORKER_SECRET")
    const received = req.headers.get("x-extracterre-worker-secret")
    if (!expected || !received || received !== expected) return json({ error: "Worker non autorise" }, 401)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = await req.json(); const action = String(body.action || ""); const jobId = String(body.jobId || "")
    if (!jobId) return json({ error: "jobId manquant" }, 400)

    if (action === "claim") {
      const { data: job, error } = await admin.from("extracterre_jobs").select("*").eq("id", jobId).single()
      if (error || !job) return json({ error: "Job introuvable" }, 404)
      const parts = Array.isArray(job.storage_parts) && job.storage_parts.length ? job.storage_parts : [{ path: job.storage_path }]
      const inputParts = []
      for (const part of parts) {
        const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(String(part.path), 600)
        if (signedError || !signed?.signedUrl) throw signedError || new Error("URL signee input impossible")
        inputParts.push({ path: part.path, url: signed.signedUrl, start: part.start ?? null, end: part.end ?? null })
      }
      const owner = job.user_id || String(job.storage_path || "").split("/")[0] || "worker"
      const resultPath = `${owner}/${jobId}/output/read.json.gz`
      const { data: upload, error: uploadError } = await admin.storage.from(BUCKET).createSignedUploadUrl(resultPath)
      if (uploadError || !upload?.token) throw uploadError || new Error("Autorisation resultat impossible")
      await admin.from("extracterre_jobs").update({ status: "processing", started_at: job.started_at || new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", jobId)
      return json({ ok: true, jobId, filename: job.original_filename, options: job.options || {}, inputParts, resultUpload: { path: resultPath, token: upload.token, signedUrl: upload.signedUrl || null } })
    }

    if (action === "complete") {
      const result = body.result && typeof body.result === "object" ? body.result : {}
      const readStoragePath = String(body.readStoragePath || "")
      if (!readStoragePath || !readStoragePath.includes(`/${jobId}/output/`)) return json({ error: "Chemin resultat invalide" }, 400)
      const { data: job, error: jobError } = await admin.from("extracterre_jobs").select("storage_path,storage_parts").eq("id", jobId).single()
      if (jobError || !job) return json({ error: "Job introuvable" }, 404)
      const { error } = await admin.from("extracterre_jobs").update({ status: "completed", result, result_storage_path: readStoragePath, result_compression: String(body.readCompression || "gzip"), completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), error_message: null }).eq("id", jobId)
      if (error) throw error
      const inputPaths = Array.isArray(job.storage_parts) && job.storage_parts.length ? job.storage_parts.map((x: any) => String(x.path || "")).filter(Boolean) : [String(job.storage_path || "")].filter(Boolean)
      if (inputPaths.length) { const { error: removeError } = await admin.storage.from(BUCKET).remove(inputPaths); if (removeError) console.warn("Nettoyage input différé", removeError) }
      return json({ ok: true, jobId, status: "completed" })
    }

    if (action === "error") {
      const message = String(body.error || "Erreur worker").slice(0, 5000)
      const { data: job } = await admin.from("extracterre_jobs").select("storage_path,storage_parts").eq("id", jobId).single()
      await admin.from("extracterre_jobs").update({ status: "error", error_message: message, completed_at: new Date().toISOString(), cleaned_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", jobId)
      const inputPaths = Array.isArray(job?.storage_parts) && job.storage_parts.length ? job.storage_parts.map((x: any) => String(x.path || "")).filter(Boolean) : [String(job?.storage_path || "")].filter(Boolean)
      if (inputPaths.length) await admin.storage.from(BUCKET).remove(inputPaths)
      return json({ ok: true, jobId, status: "error" })
    }
    return json({ error: "Action inconnue" }, 400)
  } catch (error) {
    console.error(error)
    return json({ ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" }, 500)
  }
})
