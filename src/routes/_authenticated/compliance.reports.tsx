import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FRAMEWORK_LABEL, latestChecks, listChecks, listRules, listTasks } from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance/reports")({
  component: Reports,
});

const COLORS = ["#10b981", "#f59e0b", "#ef4444"];

function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Reports() {
  const { data: latest = [] } = useQuery({ queryKey: ["compliance", "latest"], queryFn: latestChecks });
  const { data: checks = [] } = useQuery({ queryKey: ["compliance", "checks"], queryFn: () => listChecks(500) });
  const { data: tasks = [] } = useQuery({ queryKey: ["compliance", "tasks"], queryFn: listTasks });
  const { data: rules = [] } = useQuery({ queryKey: ["compliance", "rules"], queryFn: listRules });

  const statusPie = useMemo(() => {
    const counts = { pass: 0, warn: 0, fail: 0 };
    for (const c of latest) counts[c.status]++;
    return [
      { name: "Pass", value: counts.pass },
      { name: "Warn", value: counts.warn },
      { name: "Fail", value: counts.fail },
    ];
  }, [latest]);

  const byFramework = useMemo(() => {
    const map = new Map<string, { framework: string; pass: number; warn: number; fail: number }>();
    for (const c of latest) {
      const key = FRAMEWORK_LABEL[c.framework];
      const cur = map.get(key) ?? { framework: key, pass: 0, warn: 0, fail: 0 };
      cur[c.status]++;
      map.set(key, cur);
    }
    return Array.from(map.values());
  }, [latest]);

  const trend = useMemo(() => {
    const byDay = new Map<string, { day: string; fail: number; warn: number; pass: number }>();
    for (const c of [...checks].reverse()) {
      const day = c.run_at.slice(0, 10);
      const cur = byDay.get(day) ?? { day, fail: 0, warn: 0, pass: 0 };
      cur[c.status]++;
      byDay.set(day, cur);
    }
    return Array.from(byDay.values());
  }, [checks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => download("compliance-checks.csv", toCSV(checks as unknown as Record<string, unknown>[]))}><Download className="mr-2 h-4 w-4" /> Checks CSV</Button>
        <Button variant="outline" size="sm" onClick={() => download("compliance-tasks.csv", toCSV(tasks as unknown as Record<string, unknown>[]))}><Download className="mr-2 h-4 w-4" /> Tasks CSV</Button>
        <Button variant="outline" size="sm" onClick={() => download("compliance-rules.csv", toCSV(rules as unknown as Record<string, unknown>[]))}><Download className="mr-2 h-4 w-4" /> Rules CSV</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Compliance status (current)</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
                  {statusPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend /><Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By framework</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={byFramework}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="framework" /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="pass" stackId="s" fill="#10b981" />
                <Bar dataKey="warn" stackId="s" fill="#f59e0b" />
                <Bar dataKey="fail" stackId="s" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Monitoring history</CardTitle></CardHeader>
        <CardContent style={{ height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" /><YAxis /><Tooltip /><Legend />
              <Line type="monotone" dataKey="pass" stroke="#10b981" />
              <Line type="monotone" dataKey="warn" stroke="#f59e0b" />
              <Line type="monotone" dataKey="fail" stroke="#ef4444" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
