/**
 * Readiness probe: verifies the app can reach its dependencies. Used by
 * orchestrators (compose/k8s) to decide when to route traffic. Kept in
 * /api/public/* so it bypasses auth on published sites.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

async function checkSupabase(): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ok: false, latency_ms: 0, error: "missing env" };
  const t0 = Date.now();
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await client.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    if (error && !/permission|denied|not.*found/i.test(error.message)) throw error;
    return { ok: true, latency_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

export const Route = createFileRoute("/api/public/ready")({
  server: {
    handlers: {
      GET: async () => {
        const db = await checkSupabase();
        const ok = db.ok;
        return new Response(
          JSON.stringify({ status: ok ? "ready" : "degraded", checks: { supabase: db }, time: new Date().toISOString() }),
          {
            status: ok ? 200 : 503,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
