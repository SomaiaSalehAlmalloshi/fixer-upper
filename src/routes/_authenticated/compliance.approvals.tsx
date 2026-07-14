import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FRAMEWORK_LABEL, SEVERITY_COLOR, TASK_STATUS_COLOR, TASK_STATUS_LABEL, listTasks } from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance/approvals")({
  component: Approvals,
});

function Approvals() {
  const { data: tasks = [] } = useQuery({ queryKey: ["compliance", "tasks"], queryFn: listTasks });
  const queue = tasks.filter((t) => t.status === "pending_approval");
  const decided = tasks.filter((t) => t.status === "approved" || t.status === "rejected");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Awaiting decision ({queue.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>مهمة</TableHead><TableHead>Framework</TableHead><TableHead>مستوى الخطورة</TableHead><TableHead>Submitted</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {queue.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><Link to="/compliance/tasks/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.title}</Link></TableCell>
                  <TableCell className="text-xs">{FRAMEWORK_LABEL[t.framework]}</TableCell>
                  <TableCell><Badge className={SEVERITY_COLOR[t.severity]}>{t.severity}</Badge></TableCell>
                  <TableCell className="text-xs">{t.submitted_at ? new Date(t.submitted_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-right"><Link to="/compliance/tasks/$id" params={{ id: t.id }} className="text-primary text-sm hover:underline">Review →</Link></TableCell>
                </TableRow>
              ))}
              {!queue.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Nothing awaiting approval.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent decisions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>مهمة</TableHead><TableHead>Framework</TableHead><TableHead>Outcome</TableHead><TableHead>Decided</TableHead></TableRow></TableHeader>
            <TableBody>
              {decided.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><Link to="/compliance/tasks/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.title}</Link></TableCell>
                  <TableCell className="text-xs">{FRAMEWORK_LABEL[t.framework]}</TableCell>
                  <TableCell><Badge className={TASK_STATUS_COLOR[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge></TableCell>
                  <TableCell className="text-xs">{t.approved_at ? new Date(t.approved_at).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
              {!decided.length && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No decisions yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
