import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  CATEGORY_LABEL, SEVERITY_LABEL, fmtMoney, listIncidents, listRiskRegister, loadLossSummary,
  type Incident,
} from "@/lib/operational";

export const Route = createFileRoute("/_authenticated/operational/reports")({
  component: ReportsPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function ReportsPage() {
  const { data: incidents = [] } = useQuery({ queryKey: ["op", "incidents"], queryFn: () => listIncidents() });
  const { data: risks = [] } = useQuery({ queryKey: ["op", "risks"], queryFn: listRiskRegister });
  const { data: summary = [] } = useQuery({ queryKey: ["op", "summary"], queryFn: loadLossSummary });

  const trend = Array.from(
    incidents.reduce((m, i) => {
      const d = new Date(i.occurred_at).toISOString().slice(0, 10);
      m.set(d, (m.get(d) ?? 0) + Number(i.net_loss));
      return m;
    }, new Map<string, number>()),
  )
    .map(([date, net]) => ({ date, net }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const bySeverity = ["low", "medium", "high", "critical"].map((s) => ({
    name: SEVERITY_LABEL[s as keyof typeof SEVERITY_LABEL],
    count: incidents.filter((i) => i.severity === s).length,
    net: incidents.filter((i) => i.severity === s).reduce((sum, i) => sum + Number(i.net_loss), 0),
  }));

  const byCategory = summary.map((r) => ({
    name: CATEGORY_LABEL[r.category ?? "incident"] ?? "—",
    net: Number(r.total_net ?? 0),
    count: Number(r.incident_count ?? 0),
  }));

  const exportCsv = () => {
    const rows = [
      ["ref_code", "title", "category", "severity", "status", "business_line", "event_type", "gross_loss", "recovery", "net_loss", "currency", "occurred_at"],
      ...incidents.map((i: Incident) => [
        i.ref_code, i.title, i.category, i.severity, i.status, i.business_line ?? "", i.event_type ?? "",
        i.gross_loss, i.recovery, i.net_loss, i.currency, i.occurred_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operational-risk-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalNet = incidents.reduce((s, i) => s + Number(i.net_loss), 0);
  const openRisks = risks.filter((r) => r.status === "open").length;
  const criticalRisks = risks.filter((r) => r.residual_score >= 15).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">Operational Risk Reports</h2>
          <p className="text-sm text-muted-foreground">Loss-event trends, category breakdown and risk-register health.</p>
        </div>
        <Button onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Net loss YTD" value={fmtMoney(totalNet)} />
        <Stat label="Open risks" value={openRisks} />
        <Stat label="Critical risks" value={criticalRisks} accent={criticalRisks > 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Net loss trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Line type="monotone" dataKey="net" stroke="var(--chart-1)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>By category</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="net" name="Net loss" fill="var(--chart-1)" />
                <Bar yAxisId="right" dataKey="count" name="العدد" fill="var(--chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>By severity</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={bySeverity}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="net" name="Net loss" fill="var(--chart-3)">
                {bySeverity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
              <Bar yAxisId="right" dataKey="count" name="العدد" fill="var(--chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}
