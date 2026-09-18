/* ExtracTerre v2.1 — configuration publique du traitement hybride.
   La publishable key Supabase est, par conception, une clé frontend publique.
   Aucun service_role, token GitHub ou secret worker ne doit être placé ici. */
globalThis.EXTRACTERRE_CLOUD_CONFIG = Object.freeze({
  supabaseUrl: 'https://noaxrqqbyghvqhavpgan.supabase.co',
  supabasePublishableKey: 'sb_publishable_87DavZ4a2KJWAHXzO6aSwg_EQbJlnoU',
  functions: Object.freeze({
    createJob: 'extracterre-create-job',
    startJob: 'extracterre-start-job',
    jobStatus: 'extracterre-job-status',
    finishJob: 'extracterre-finish-job'
  }),
  storageBucket: 'extracterre-temp',
  autoRemoteMinBytes: 6 * 1024 * 1024,
  maxRemoteBytes: 700 * 1024 * 1024,
  pollIntervalMs: 1400,
  maxWaitMs: 25 * 60 * 1000
});
