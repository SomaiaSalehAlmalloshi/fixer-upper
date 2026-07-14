import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ASSET_LABEL, fmtMoney, listPositions, listVarRuns, loadMarketSummary } from "@/lib/market";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/market/reports")({
  component: ReportsPage,
});

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}
function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { data: positions = [] } = useQuery({ queryKey: ["market", "positions"], queryFn: listPositions });
  const { data: runs = [] } = useQuery({ queryKey: ["market", "var-runs"], queryFn: listVarRuns });
  const { data: summary = [] } = useQuery({ queryKey: ["market", "summary"], queryFn: loadMarketSummary });

  const byClass = summary.map((r) => ({
    name: ASSET_LABEL[(r.asset_class ?? "fx") as keyof typeof ASSET_LABEL] ?? r.asset_class,
    mv: Number(r.total_mv),
    dv01: Number(r.total_dv01),
    sens: Number(r.total_sensitivity),
  }));
  const varTrend = [...runs].reverse().map((r) => ({
    name: new Date(r.run_at).toLocaleDateString(),
    var: Number(r.var_amount),
    es: Number(r.es_amount),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => download("market-positions.csv", toCsv(positions as unknown as Record<string, unknown>[]))}>
          <Download className="mr-2 h-4 w-4" /> Positions CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => download("market-var-runs.csv", toCsv(runs as unknown as Record<string, unknown>[]))}>
          <Download className="mr-2 h-4 w-4" /> VaR runs CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => download("market-summary.csv", toCsv(summary as unknown as Record<string, unknown>[]))}>
          <Download className="mr-2 h-4 w-4" /> Summary CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Exposure & sensitivity by class</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="mv" fill="var(--chart-1)" name="MV" />
                <Bar dataKey="sens" fill="var(--chart-3)" name="الحساسية" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>VaR history</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={varTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${(v / 1_000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Line type="monotone" dataKey="var" stroke="var(--chart-1)" name="القيمة المعرّضة للمخاطر (VaR)" />
                <Line type="monotone" dataKey="es" stroke="var(--chart-4)" name="ES" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}