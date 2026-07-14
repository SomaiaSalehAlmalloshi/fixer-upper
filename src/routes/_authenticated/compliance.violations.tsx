import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertOctagon, Wand2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  FRAMEWORK_LABEL, METRIC_LABEL, OP_LABEL, SEVERITY_COLOR, STATUS_COLOR,
  createTaskFromCheck, fmtValue, latestChecks, listRules, listTasks,
} from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance/violations")({
  component: Violations,
});

function Violations() {
  const qc = useQueryClient();
  const { user, canWrite } = useAuth();
  const { data: checks = [] } = useQuery({ queryKey: ["compliance", "latest"], queryFn: latestChecks });
  const { data: rules = [] } = useQuery({ queryKey: ["compliance", "rules"], queryFn: listRules });
  const { data: tasks = [] } = useQuery({ queryKey: ["compliance", "tasks"], queryFn: listTasks });

  const failing = useMemo(() => checks.filter((c) => c.status !== "pass"), [checks]);
  const withTask = new Set(tasks.map((t) => t.check_id).filter(Boolean));

  const remediate = useMutation({
    mutationFn: (payload: { checkId: string }) => {
      const check = checks.find((c) => c.id === payload.checkId)!;
      const rule = rules.find((r) => r.id === check.rule_id) ?? null;
      return createTaskFromCheck(check, rule, user!.id);
    },
    onSuccess: () => { toast.success("Remediation task created"); qc.invalidateQueries({ queryKey: ["compliance", "tasks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertOctagon className="h-4 w-4" />
        Rules currently failing or warning against the live portfolio. Create a task to route into the remediation workflow.
      </div>
      <Card>
        <CardHeader><CardTitle>Open violations</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Rule</TableHead><TableHead>Framework</TableHead><TableHead>Metric</TableHead>
              <TableHead className="text-right">القيمة</TableHead><TableHead>Threshold</TableHead>
              <TableHead>مستوى الخطورة</TableHead><TableHead>الحالة</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {failing.map((c) => {
                const rule = rules.find((r) => r.id === c.rule_id);
                const unit = rule?.unit ?? "ratio";
                const hasTask = withTask.has(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell><div className="font-medium">{c.rule_code}</div><div className="text-xs text-muted-foreground">{c.rule_name}</div></TableCell>
                    <TableCell className="text-xs">{FRAMEWORK_LABEL[c.framework]}</TableCell>
                    <TableCell className="text-xs">{METRIC_LABEL[c.metric]}</TableCell>
                    <TableCell className="text-right font-mono">{fmtValue(Number(c.metric_value), unit)}</TableCell>
                    <TableCell className="text-xs">{OP_LABEL[c.operator]} {fmtValue(Number(c.threshold_fail), unit)}</TableCell>
                    <TableCell><Badge className={SEVERITY_COLOR[c.severity]}>{c.severity}</Badge></TableCell>
                    <TableCell><Badge className={STATUS_COLOR[c.status]}>{c.status.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-right">
                      {canWrite && (
                        <Button size="sm" variant="outline" disabled={hasTask || remediate.isPending} onClick={() => remediate.mutate({ checkId: c.id })}>
                          <Wand2 className="mr-2 h-3.5 w-3.5" /> {hasTask ? "Task exists" : "Create task"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!failing.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-emerald-500">All monitored rules pass. 🎉</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>التوصيات</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {failing.map((c) => {
            const rule = rules.find((r) => r.id === c.rule_id);
            return (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{c.rule_code} — {c.rule_name}</div>
                  <Badge className={SEVERITY_COLOR[c.severity]}>{c.severity}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{rule?.recommendation ?? "Investigate the metric drivers and design a remediation plan."}</p>
                {rule?.reference && <p className="mt-1 text-xs text-muted-foreground">Reference: {rule.reference}</p>}
              </div>
            );
          })}
          {!failing.length && <p className="text-sm text-muted-foreground">No recommendations required.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
