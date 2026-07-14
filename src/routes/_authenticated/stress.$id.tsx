import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  SEVERITY_COLOR, SEVERITY_LABEL, TYPE_LABEL, fmtMoney, fmtPct, getRun,
  runStress, severityColor,
} from "@/lib/stress";
import { analyzeStressRun } from "@/lib/stress.functions";

export const Route = createFileRoute("/_authenticated/stress/$id")({
  component: RunPage,
});

type Results = ReturnType<typeof runStress>;

function RunPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: run } = useQuery({ queryKey: ["stress", "run", id], queryFn: () => getRun(id) });

  const analyze = useMutation({
    mutationFn: async () => analyzeStressRun({
      data: {
        run_id: id,
        scenario_name: run!.scenario_name,
        stress_type: run!.stress_type,
        severity: run!.severity,
        parameters: run!.parameters as Record<string, unknown>,
        results: run!.results as Record<string, unknown>,
      },
    }),
    onSuccess: () => { toast.success("AI analysis complete"); qc.invalidateQueries({ queryKey: ["stress", "run", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!run) return <div className="text-muted-foreground">Loading run…</div>;
  const r = run.results as never as Results;

  const dimensionChart = [
    { name: "Market P&L", baseline: 0, stressed: r.market.stressed_pnl },
    { name: "Credit EL", baseline: r.credit.baseline_el, stressed: r.credit.stressed_el },
    { name: "HQLA", baseline: r.liquidity.baseline_hqla, stressed: r.liquidity.stressed_hqla },
    { name: "Net outflow 30d", baseline: r.liquidity.baseline_net_outflow, stressed: r.liquidity.stressed_net_outflow },
  ];
  const ratiosChart = [
    { name: "Baseline LCR", value: r.liquidity.baseline_lcr * 100 },
    { name: "Stressed LCR", value: r.liquidity.stressed_lcr * 100 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/stress"><ArrowLeft className="mr-1 h-4 w-4" /> رجوع</Link></Button>
        <h2 className="text-xl font-semibold">{run.scenario_name}</h2>
        <Badge variant="secondary">{TYPE_LABEL[run.stress_type]}</Badge>
        <Badge className={SEVERITY_COLOR[run.severity]}>{SEVERITY_LABEL[run.severity]}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">{new Date(run.run_at).toLocaleString()}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Market P&L" value={fmtMoney(r.market.stressed_pnl)} sub={fmtPct(r.market.stressed_pnl_pct)} cls={r.market.stressed_pnl < 0 ? "text-destructive" : "text-emerald-500"} />
        <Kpi label="Δ Expected Loss" value={fmtMoney(r.credit.delta_el)} sub={"Base: " + fmtMoney(r.credit.baseline_el)} cls={r.credit.delta_el > 0 ? "text-destructive" : ""} />
        <Kpi label="Stressed LCR" value={isFinite(r.liquidity.stressed_lcr) ? fmtPct(r.liquidity.stressed_lcr, 0) : "∞"} sub={"Base: " + (isFinite(r.liquidity.baseline_lcr) ? fmtPct(r.liquidity.baseline_lcr, 0) : "∞")} cls={r.liquidity.stressed_lcr < 1 ? "text-destructive" : ""} />
        <Kpi label="Capital impact" value={fmtPct(r.totals.capital_impact_pct)} sub={"Total loss: " + fmtMoney(r.totals.total_loss)} cls={severityColor(r)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Baseline vs stressed</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={dimensionChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend />
                <Bar dataKey="baseline" fill="var(--chart-1)" name="Baseline" />
                <Bar dataKey="stressed" fill="var(--chart-4)" name="Stressed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>LCR impact</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={ratiosChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => v.toFixed(0) + "%"} />
                <Tooltip formatter={(v: number) => v.toFixed(1) + "%"} />
                <Bar dataKey="value">
                  {ratiosChart.map((d, i) => <Cell key={i} fill={d.value < 100 ? "var(--destructive)" : "var(--chart-2)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>AI Analysis</CardTitle>
          <Button size="sm" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
            <Sparkles className="mr-2 h-4 w-4" /> {run.ai_analysis ? "Regenerate" : "Analyze"}
          </Button>
        </CardHeader>
        <CardContent>
          {run.ai_analysis ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{run.ai_analysis}</div>
          ) : (
            <p className="text-sm text-muted-foreground">Click Analyze to generate a written risk officer assessment of this run.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Parameters</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(run.parameters, null, 2)}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, cls }: { label: string; value: React.ReactNode; sub?: string; cls?: string }) {
  return <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">{label}</div><div className={"mt-2 text-2xl font-semibold " + (cls ?? "")}>{value}</div>{sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}</CardContent></Card>;
}
