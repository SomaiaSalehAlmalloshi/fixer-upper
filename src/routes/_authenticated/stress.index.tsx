import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Trash2, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { listCashFlows, listHqla } from "@/lib/liquidity";
import { listPositions } from "@/lib/market";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  SEVERITY_COLOR, SEVERITY_LABEL, TYPE_ICON, TYPE_LABEL, deleteScenario, fmtMoney, fmtPct,
  listRuns, listScenarios, runStress, saveRun, severityColor,
  type StressParams, type StressScenario,
} from "@/lib/stress";

export const Route = createFileRoute("/_authenticated/stress/")({
  component: StressOverview,
});

type Loan = Database["public"]["Tables"]["credit_loans"]["Row"];

function StressOverview() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { user, canWrite, isAdmin } = useAuth();

  const { data: scenarios = [] } = useQuery({ queryKey: ["stress", "scenarios"], queryFn: listScenarios });
  const { data: runs = [] } = useQuery({ queryKey: ["stress", "runs"], queryFn: () => listRuns(20) });

  const runScenario = useMutation({
    mutationFn: async (sc: StressScenario) => {
      const [positions, hqla, flows, loansRes] = await Promise.all([
        listPositions(),
        listHqla(),
        listCashFlows(),
        supabase.from("credit_loans").select("*"),
      ]);
      if (loansRes.error) throw loansRes.error;
      const loans = (loansRes.data ?? []) as Loan[];
      const results = runStress(sc.parameters as StressParams, positions, loans, hqla, flows);
      const run = await saveRun({
        scenario_id: sc.id,
        scenario_name: sc.name,
        stress_type: sc.stress_type,
        severity: sc.severity,
        parameters: sc.parameters,
        results: results as never,
        run_by: user!.id,
      });
      return run;
    },
    onSuccess: (run) => {
      toast.success("Scenario executed");
      qc.invalidateQueries({ queryKey: ["stress", "runs"] });
      nav({ to: "/stress/$id", params: { id: run.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteScenario,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["stress", "scenarios"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const presets = scenarios.filter((s) => s.is_preset);
  const custom = scenarios.filter((s) => !s.is_preset);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Preset scenarios</h2>
          {canWrite && (
            <Button asChild><Link to="/stress/builder"><Plus className="mr-2 h-4 w-4" /> Custom scenario</Link></Button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {presets.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base"><span className="mr-2">{TYPE_ICON[s.stress_type]}</span>{s.name}</CardTitle>
                  <Badge className={SEVERITY_COLOR[s.severity]}>{SEVERITY_LABEL[s.severity]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <p className="text-sm text-muted-foreground">{s.description}</p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={runScenario.isPending} onClick={() => runScenario.mutate(s)}>
                    <Play className="mr-2 h-3.5 w-3.5" /> Run
                  </Button>
                  <Button asChild size="sm" variant="outline"><Link to="/stress/builder" search={{ from: s.id } as never}>Clone</Link></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {custom.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Custom scenarios</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>النوع</TableHead><TableHead>مستوى الخطورة</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {custom.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{TYPE_LABEL[s.stress_type]}</TableCell>
                      <TableCell><Badge className={SEVERITY_COLOR[s.severity]}>{SEVERITY_LABEL[s.severity]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => runScenario.mutate(s)}><Play className="h-4 w-4" /></Button>
                        {isAdmin && <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recent runs</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Scenario</TableHead><TableHead>النوع</TableHead><TableHead>مستوى الخطورة</TableHead>
                <TableHead className="text-right">Market P&amp;L</TableHead>
                <TableHead className="text-right">Δ EL</TableHead>
                <TableHead className="text-right">Stressed LCR</TableHead>
                <TableHead className="text-right">Capital impact</TableHead>
                <TableHead>Run at</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {runs.map((r) => {
                  const res = r.results as never as ReturnType<typeof runStress>;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => nav({ to: "/stress/$id", params: { id: r.id } })}>
                      <TableCell>{r.scenario_name}</TableCell>
                      <TableCell>{TYPE_LABEL[r.stress_type]}</TableCell>
                      <TableCell><Badge className={SEVERITY_COLOR[r.severity]}>{SEVERITY_LABEL[r.severity]}</Badge></TableCell>
                      <TableCell className={"text-right " + (res.market.stressed_pnl < 0 ? "text-destructive" : "text-emerald-500")}>{fmtMoney(res.market.stressed_pnl)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(res.credit.delta_el)}</TableCell>
                      <TableCell className="text-right">{isFinite(res.liquidity.stressed_lcr) ? fmtPct(res.liquidity.stressed_lcr, 0) : "∞"}</TableCell>
                      <TableCell className={"text-right font-semibold " + severityColor(res)}>{fmtPct(res.totals.capital_impact_pct, 1)}</TableCell>
                      <TableCell className="text-xs">{new Date(r.run_at).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
                {!runs.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No runs yet — pick a scenario above.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
