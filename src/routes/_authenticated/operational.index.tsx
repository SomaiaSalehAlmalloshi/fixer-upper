import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, DollarSign, ShieldAlert, Activity } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  CATEGORY_LABEL, KRI_COLOR, fmtMoney, listIncidents, listKris, listRiskRegister,
  loadLossSummary, riskLevel,
} from "@/lib/operational";

export const Route = createFileRoute("/_authenticated/operational/")({
  component: OperationalOverview,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function OperationalOverview() {
  const { data: incidents = [] } = useQuery({ queryKey: ["op", "incidents"], queryFn: () => listIncidents() });
  const { data: kris = [] } = useQuery({ queryKey: ["op", "kris"], queryFn: listKris });
  const { data: risks = [] } = useQuery({ queryKey: ["op", "risks"], queryFn: listRiskRegister });
  const { data: summary = [] } = useQuery({ queryKey: ["op", "summary"], queryFn: loadLossSummary });

  const openCount = incidents.filter((i) => !["resolved", "closed"].includes(i.status)).length;
  const critical = incidents.filter((i) => i.severity === "critical").length;
  const totalNet = incidents.reduce((s, i) => s + Number(i.net_loss), 0);
  const redKris = kris.filter((k) => k.status === "red").length;

  const byCategory = summary.map((r) => ({
    name: CATEGORY_LABEL[r.category ?? "incident"] ?? r.category ?? "—",
    net: Number(r.total_net ?? 0),
    count: Number(r.incident_count ?? 0),
  }));

  const bySeverity = ["low", "medium", "high", "critical"].map((s) => ({
    name: s,
    value: incidents.filter((i) => i.severity === s).length,
  }));

  const topRisks = [...risks].sort((a, b) => b.residual_score - a.residual_score).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={AlertTriangle} label="Open incidents" value={openCount} accent={openCount > 0} />
        <Stat icon={ShieldAlert} label="Critical" value={critical} accent={critical > 0} />
        <Stat icon={DollarSign} label="Net loss YTD" value={fmtMoney(totalNet)} />
        <Stat icon={Activity} label="Red KRIs" value={redKris} accent={redKris > 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Net loss by category</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="net" fill="var(--chart-1)" name="Net loss" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Incidents by severity</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={bySeverity} dataKey="value" nameKey="name" outerRadius={90} label>
                  {bySeverity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top residual risks</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topRisks.map((r) => {
              const lvl = riskLevel(r.residual_score);
              return (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.risk_code} • {r.category}</div>
                  </div>
                  <div className="text-right">
                    <div className={"text-lg font-semibold " + lvl.cls}>{r.residual_score}</div>
                    <div className="text-xs text-muted-foreground">{lvl.label}</div>
                  </div>
                </div>
              );
            })}
            {!topRisks.length && <div className="py-6 text-center text-sm text-muted-foreground">No risks recorded.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>KRI status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {kris.slice(0, 6).map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="text-xs text-muted-foreground">{k.code} • {k.frequency}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-medium">{k.current_value}</div>
                    <div className="text-xs text-muted-foreground">{k.unit}</div>
                  </div>
                  <Badge className={KRI_COLOR[k.status]}>{k.status.toUpperCase()}</Badge>
                </div>
              </div>
            ))}
            {!kris.length && <div className="py-6 text-center text-sm text-muted-foreground">No KRIs defined.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
        <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}
