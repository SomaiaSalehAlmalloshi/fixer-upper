import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { fmtMoney, listLoans } from "@/lib/credit";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
  PieChart, Pie,
} from "recharts";

export const Route = createFileRoute("/_authenticated/credit/reports")({
  component: Reports,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Reports() {
  const { data: loans = [] } = useQuery({ queryKey: ["credit", "loans"], queryFn: listLoans });

  const byStatus = ["active", "default", "closed", "written_off", "restructured"].map((s) => ({
    status: s,
    count: loans.filter((l) => l.status === s).length,
    ead: loans.filter((l) => l.status === s).reduce((a, l) => a + Number(l.ead), 0),
    el: loans.filter((l) => l.status === s).reduce((a, l) => a + Number(l.expected_loss), 0),
  }));

  const buckets = [
    { label: "Current", min: 0, max: 0 },
    { label: "1-30", min: 1, max: 30 },
    { label: "31-60", min: 31, max: 60 },
    { label: "61-90", min: 61, max: 90 },
    { label: "90+", min: 91, max: 99999 },
  ];
  const aging = buckets.map((b) => ({
    bucket: b.label,
    ead: loans.filter((l) => l.days_past_due >= b.min && l.days_past_due <= b.max).reduce((a, l) => a + Number(l.ead), 0),
  }));

  const byDay = Array.from(
    loans.reduce((m, l) => {
      const d = new Date(l.created_at).toISOString().slice(0, 10);
      m.set(d, (m.get(d) ?? 0) + Number(l.expected_loss));
      return m;
    }, new Map<string, number>()),
  ).map(([date, el]) => ({ date, el })).sort((a, b) => a.date.localeCompare(b.date));

  const exportCsv = () => {
    const rows = [
      ["loan_number", "borrower", "product", "currency", "outstanding", "ead", "pd_override", "lgd", "expected_loss", "dpd", "status"],
      ...loans.map((l) => {
        const b = (l as { borrower?: { code: string; name: string } | null }).borrower;
        return [
          l.loan_number, b ? `${b.code}-${b.name}` : "", l.product_type, l.currency,
          l.outstanding, l.ead, l.pd_override ?? "", l.lgd, l.expected_loss, l.days_past_due, l.status,
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credit-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Credit Reports</h2>
        <Button onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>EAD by loan status</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend />
                <Bar dataKey="ead" fill="var(--chart-1)" name="التعرّض عند التعثّر (EAD)" />
                <Bar dataKey="el" fill="var(--chart-4)" name="EL" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>EAD by DPD bucket</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={aging} dataKey="ead" nameKey="bucket" outerRadius={90} label>
                  {aging.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Expected loss over time</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `${(v / 1_000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Line type="monotone" dataKey="el" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}