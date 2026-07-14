import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MODULE_LABEL, listEvents } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/workflow/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { data: events = [] } = useQuery({ queryKey: ["wf", "events"], queryFn: () => listEvents(undefined, 500) });
  return (
    <Card>
      <CardHeader><CardTitle>سجل تدقيق سير العمل</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>الوقت</TableHead><TableHead>الوحدة</TableHead><TableHead>الحدث</TableHead>
            <TableHead>الفاعل</TableHead><TableHead>الجهة</TableHead><TableHead>الرسالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{MODULE_LABEL[e.source_module]}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{e.event_type}</TableCell>
                <TableCell className="font-mono text-xs">{e.actor?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{e.target_user?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="text-sm">{e.message ?? "—"}</TableCell>
              </TableRow>
            ))}
            {events.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">لا توجد أحداث بعد.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
