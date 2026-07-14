import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  SEVERITY_COLOR, SEVERITY_LABEL, TYPE_LABEL, fmtMoney, fmtPct, listRuns,
  runStress, severityColor,
} from "@/lib/stress";

export const Route = createFileRoute("/_authenticated/stress/reports")({
  component: ReportsPage,
});

type Results = ReturnType<typeof runStress>;

function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}
function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

function ReportsPage() {
  const nav = useNavigate();
  const { data: runs = [] } = useQuery({ queryKey: ["stress", "runs", "all"], queryFn: () => listRuns(100) });

  const chart = runs.slice(0, 12).reverse().map((r) => {
    const res = r.results as never as Results;
    return {
      name: r.scenario_name.length > 14 ? r.scenario_name.slice(0, 14) + "…" : r.scenario_name,
      loss: res.totals.total_loss,
      capital_pct: res.totals.capital_impact_pct * 100,
    };
  });

  const exportCsv = () => download("stress_runs.csv", toCsv([
    ["Scenario", "النوع", "مستوى الخطورة", "Run at", "Market P&L", "Delta EL", "Baseline LCR", "Stressed LCR", "Total loss", "Capital impact %"],
    ...runs.map((r) => {
      const res = r.results as never as Results;
      return [
        r.scenario_name, r.stress_type, r.severity, r.run_at,
        res.market.stressed_pnl, res.credit.delta_el,
        res.liquidity.baseline_lcr, res.liquidity.stressed_lcr,
        res.totals.total_loss, (res.totals.capital_impact_pct * 100).toFixed(2),
      ];
    }),
  ]));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Total loss per recent run</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Bar dataKey="loss" fill="var(--chart-4)" name="Total loss" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Scenario</TableHead><TableHead>النوع</TableHead><TableHead>مستوى الخطورة</TableHead>
              <TableHead className="text-right">Market P&amp;L</TableHead><TableHead className="text-right">Δ EL</TableHead>
              <TableHead className="text-right">Stressed LCR</TableHead><TableHead className="text-right">Capital impact</TableHead>
              <TableHead>Run at</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {runs.map((r) => {
                const res = r.results as never as Results;
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
              {!runs.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No runs yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
