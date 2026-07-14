import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, ShieldCheck, ShieldAlert, ShieldX, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  FRAMEWORK_LABEL, METRIC_LABEL, OP_LABEL, SEVERITY_COLOR, STATUS_COLOR,
  fmtValue, latestChecks, listRules, listTasks, runMonitoring,
} from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance/")({
  component: ComplianceOverview,
});

function ComplianceOverview() {
  const qc = useQueryClient();
  const { user, canWrite } = useAuth();

  const rulesQ = useQuery({ queryKey: ["compliance", "rules"], queryFn: listRules });
  const checksQ = useQuery({ queryKey: ["compliance", "latest"], queryFn: latestChecks });
  const tasksQ = useQuery({ queryKey: ["compliance", "tasks"], queryFn: listTasks });

  const run = useMutation({
    mutationFn: () => runMonitoring(user!.id),
    onSuccess: (rows) => {
      const fails = rows.filter((r) => r.status === "fail").length;
      const warns = rows.filter((r) => r.status === "warn").length;
      toast.success(`Monitoring complete: ${rows.length} rules · ${fails} failed · ${warns} warned`);
      qc.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checks = checksQ.data ?? [];
  const rules = rulesQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  const pass = checks.filter((c) => c.status === "pass").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const fail = checks.filter((c) => c.status === "fail").length;
  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const pending = tasks.filter((t) => t.status === "pending_approval").length;

  const byFramework = rules.reduce<Record<string, number>>((acc, r) => {
    acc[r.framework] = (acc[r.framework] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />} label="Passing" value={pass} />
        <StatCard icon={<ShieldAlert className="h-4 w-4 text-amber-500" />} label="Warnings" value={warn} />
        <StatCard icon={<ShieldX className="h-4 w-4 text-destructive" />} label="Violations" value={fail} />
        <StatCard icon={<ClipboardCheck className="h-4 w-4 text-blue-500" />} label="Open tasks" value={openTasks} sub={pending ? `${pending} awaiting approval` : undefined} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Frameworks</CardTitle>
            <p className="text-sm text-muted-foreground">{rules.length} active rules · {Object.entries(byFramework).map(([k, v]) => `${FRAMEWORK_LABEL[k as keyof typeof FRAMEWORK_LABEL]} (${v})`).join(" · ")}</p>
          </div>
          {canWrite && (
            <Button onClick={() => run.mutate()} disabled={run.isPending}>
              <Play className="mr-2 h-4 w-4" /> {run.isPending ? "Running…" : "Run monitoring"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <FrameworkTile framework="basel_iii" rules={rules.filter((r) => r.framework === "basel_iii").length} status="نشط" />
            <FrameworkTile framework="basel_iv" rules={rules.filter((r) => r.framework === "basel_iv").length} status="Reserved" />
            <FrameworkTile framework="local" rules={rules.filter((r) => r.framework === "local").length} status="اختياري" />
            <FrameworkTile framework="other" rules={rules.filter((r) => r.framework === "other").length} status="اختياري" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Latest check per rule</CardTitle>
          <Button asChild variant="outline" size="sm"><Link to="/compliance/monitoring">Full history</Link></Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Rule</TableHead><TableHead>Framework</TableHead><TableHead>Metric</TableHead>
              <TableHead className="text-right">القيمة</TableHead><TableHead>Threshold</TableHead>
              <TableHead>مستوى الخطورة</TableHead><TableHead>الحالة</TableHead><TableHead>الوقت</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {checks.map((c) => {
                const rule = rules.find((r) => r.id === c.rule_id);
                const unit = rule?.unit ?? "ratio";
                return (
                  <TableRow key={c.id}>
                    <TableCell><div className="font-medium">{c.rule_code}</div><div className="text-xs text-muted-foreground">{c.rule_name}</div></TableCell>
                    <TableCell className="text-xs">{FRAMEWORK_LABEL[c.framework]}</TableCell>
                    <TableCell className="text-xs">{METRIC_LABEL[c.metric]}</TableCell>
                    <TableCell className="text-right font-mono">{fmtValue(Number(c.metric_value), unit)}</TableCell>
                    <TableCell className="text-xs">{OP_LABEL[c.operator]} {fmtValue(Number(c.threshold_fail), unit)}</TableCell>
                    <TableCell><Badge className={SEVERITY_COLOR[c.severity]}>{c.severity}</Badge></TableCell>
                    <TableCell><Badge className={STATUS_COLOR[c.status]}>{c.status.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(c.run_at).toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
              {!checks.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No checks yet — run monitoring to evaluate all active rules.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function FrameworkTile({ framework, rules, status }: { framework: keyof typeof FRAMEWORK_LABEL; rules: number; status: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-sm font-medium">{FRAMEWORK_LABEL[framework]}</div>
      <div className="mt-1 text-2xl font-semibold">{rules}</div>
      <div className="text-xs text-muted-foreground">{status} · {rules === 1 ? "rule" : "rules"}</div>
    </div>
  );
}
