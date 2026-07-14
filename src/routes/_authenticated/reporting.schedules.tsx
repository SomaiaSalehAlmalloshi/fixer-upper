import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AUDIENCE_LABEL, CADENCE_LABEL, FORMAT_LABEL, deleteSchedule, listSchedules, upsertSchedule, type Audience, type Format } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/reporting/schedules")({
  component: Schedules,
});

function Schedules() {
  const qc = useQueryClient();
  const { canWrite, isAdmin } = useAuth();
  const { data: schedules = [] } = useQuery({ queryKey: ["report-schedules"], queryFn: listSchedules });

  const toggle = useMutation({
    mutationFn: (s: { id: string; active: boolean }) => upsertSchedule({ id: s.id, active: !s.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-schedules"] }),
  });
  const remove = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["report-schedules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled reports</CardTitle>
        <p className="text-sm text-muted-foreground">Schedules are saved with cadence, formats and recipients. Distribution is prepared per run from the report page — connect an email provider later to send automatically.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>التقرير</TableHead><TableHead>Audience</TableHead><TableHead>Cadence</TableHead>
            <TableHead>Formats</TableHead><TableHead>Recipients</TableHead>
            <TableHead>Next run</TableHead><TableHead>نشط</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link to="/reporting/$key" params={{ key: s.report_key }} className="font-medium hover:underline">{s.report_name}</Link>
                  {s.notes && <div className="text-xs text-muted-foreground">{s.notes}</div>}
                </TableCell>
                <TableCell className="text-xs">{AUDIENCE_LABEL[s.audience as Audience] ?? s.audience}</TableCell>
                <TableCell className="text-xs">{CADENCE_LABEL[s.cadence]}</TableCell>
                <TableCell className="text-xs">{(s.formats as Format[]).map((f) => FORMAT_LABEL[f]).join(", ")}</TableCell>
                <TableCell className="text-xs">
                  {(s.recipients ?? []).slice(0, 3).map((r) => <Badge key={r} variant="outline" className="mr-1">{r}</Badge>)}
                  {(s.recipients ?? []).length > 3 && <span className="text-muted-foreground">+{s.recipients.length - 3}</span>}
                </TableCell>
                <TableCell className="text-xs">{s.next_run_at ? new Date(s.next_run_at).toLocaleString() : "—"}</TableCell>
                <TableCell><Switch checked={s.active} disabled={!canWrite} onCheckedChange={() => toggle.mutate({ id: s.id, active: s.active })} /></TableCell>
                <TableCell className="text-right">{isAdmin && <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
            {!schedules.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No schedules yet. Open a report and click Schedule to add one.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
