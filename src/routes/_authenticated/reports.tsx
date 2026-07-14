import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { loadAssets, fmtMoney, type Asset } from "@/lib/rwa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Reports() {
  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: () => loadAssets() });

  const approved = assets.filter((a) => a.status === "approved");

  const byStatus = ["draft", "pending", "approved", "rejected"].map((s) => ({
    status: s,
    count: assets.filter((a) => a.status === s).length,
    rwa: assets.filter((a) => a.status === s).reduce((sum, a) => sum + Number(a.rwa_amount), 0),
  }));

  const byClass = Array.from(
    approved.reduce((m, a) => {
      const k = `${a.category}/${a.asset_class}`;
      m.set(k, (m.get(k) ?? 0) + Number(a.rwa_amount));
      return m;
    }, new Map<string, number>()),
  )
    .map(([name, rwa]) => ({ name, rwa }))
    .sort((a, b) => b.rwa - a.rwa)
    .slice(0, 8);

  // Trend by day (created_at)
  const byDay = Array.from(
    approved.reduce((m, a) => {
      const d = new Date(a.created_at).toISOString().slice(0, 10);
      m.set(d, (m.get(d) ?? 0) + Number(a.rwa_amount));
      return m;
    }, new Map<string, number>()),
  )
    .map(([date, rwa]) => ({ date, rwa }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const exportCsv = () => {
    const rows = [
      ["reference_code", "name", "category", "asset_class", "counterparty_type", "rating", "exposure_amount", "risk_weight", "rwa_amount", "currency", "status", "created_at"],
      ...assets.map((a: Asset) => [
        a.reference_code, a.name, a.category, a.asset_class, a.counterparty_type ?? "", a.rating ?? "",
        a.exposure_amount, a.risk_weight, a.rwa_amount, a.currency, a.status, a.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rwa-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">التقارير</h1>
          <p className="text-muted-foreground">Approved RWA analytics and portfolio breakdown.</p>
        </div>
        <Button onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>RWA trend (approved)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => (v / 1_000_000).toFixed(0) + "M"} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Line type="monotone" dataKey="rwa" stroke="var(--chart-1)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top asset classes</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byClass} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tickFormatter={(v) => (v / 1_000_000).toFixed(0) + "M"} />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="rwa">
                  {byClass.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>By status</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="status" />
              <YAxis yAxisId="left" tickFormatter={(v) => (v / 1_000_000).toFixed(0) + "M"} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="rwa" name="الأصول المرجّحة" fill="var(--chart-1)" />
              <Bar yAxisId="right" dataKey="count" name="العدد" fill="var(--chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
