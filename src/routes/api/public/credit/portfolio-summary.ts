import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Public read-only credit portfolio summary API.
// Safe to expose: aggregated per-borrower metrics, no PII beyond borrower code/name.
// Protected by the SELECT-only publishable key + view is `security_invoker` so RLS applies.
export const Route = createFileRoute("/api/public/credit/portfolio-summary")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return new Response("Backend not configured", { status: 500 });
        const supabase = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data, error } = await supabase
          .from("credit_portfolio_summary")
          .select("code, name, borrower_type, industry, country, credit_rating, pd, loan_count, total_outstanding, total_ead, total_el, max_dpd, has_default")
          .order("total_ead", { ascending: false });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
        const totals = (data ?? []).reduce(
          (acc, r) => {
            acc.outstanding += Number(r.total_outstanding ?? 0);
            acc.ead += Number(r.total_ead ?? 0);
            acc.el += Number(r.total_el ?? 0);
            return acc;
          },
          { outstanding: 0, ead: 0, el: 0 },
        );
        return Response.json({ totals, borrowers: data ?? [] }, {
          headers: { "cache-control": "public, max-age=60" },
        });
      },
    },
  },
});