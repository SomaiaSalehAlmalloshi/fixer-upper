import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  FRAMEWORK_LABEL, METRIC_LABEL, OP_LABEL, SEVERITY_COLOR, STATUS_COLOR,
  fmtValue, listChecks, listRules, runMonitoring,
} from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance/monitoring")({
  component: Monitoring,
});

function Monitoring() {
  const qc = useQueryClient();
  const { user, canWrite } = useAuth();
  const { data: checks = [] } = useQuery({ queryKey: ["compliance", "checks"], queryFn: () => listChecks(300) });
  const { data: rules = [] } = useQuery({ queryKey: ["compliance", "rules"], queryFn: listRules });

  const run = useMutation({
    mutationFn: () => runMonitoring(user!.id),
    onSuccess: (rows) => {
      toast.success(`${rows.length} rules evaluated`);
      qc.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Monitoring history</CardTitle>
          <p className="text-sm text-muted-foreground">Every scheduled or manual evaluation of the rule set.</p>
        </div>
        {canWrite && (
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            <Play className="mr-2 h-4 w-4" /> Run now
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Run at</TableHead><TableHead>Rule</TableHead><TableHead>Framework</TableHead>
            <TableHead>Metric</TableHead><TableHead className="text-right">القيمة</TableHead>
            <TableHead>Threshold</TableHead><TableHead>مستوى الخطورة</TableHead><TableHead>الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {checks.map((c) => {
              const rule = rules.find((r) => r.id === c.rule_id);
              const unit = rule?.unit ?? "ratio";
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(c.run_at).toLocaleString()}</TableCell>
                  <TableCell><div className="font-medium">{c.rule_code}</div><div className="text-xs text-muted-foreground">{c.rule_name}</div></TableCell>
                  <TableCell className="text-xs">{FRAMEWORK_LABEL[c.framework]}</TableCell>
                  <TableCell className="text-xs">{METRIC_LABEL[c.metric]}</TableCell>
                  <TableCell className="text-right font-mono">{fmtValue(Number(c.metric_value), unit)}</TableCell>
                  <TableCell className="text-xs">{OP_LABEL[c.operator]} {fmtValue(Number(c.threshold_fail), unit)}</TableCell>
                  <TableCell><Badge className={SEVERITY_COLOR[c.severity]}>{c.severity}</Badge></TableCell>
                  <TableCell><Badge className={STATUS_COLOR[c.status]}>{c.status.toUpperCase()}</Badge></TableCell>
                </TableRow>
              );
            })}
            {!checks.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No monitoring runs yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
