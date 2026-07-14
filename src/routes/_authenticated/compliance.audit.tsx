import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAudit } from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance/audit")({
  component: Audit,
});

function Audit() {
  const { data: entries = [] } = useQuery({ queryKey: ["compliance", "audit-all"], queryFn: () => listAudit(undefined, 500) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit trail</CardTitle>
        <p className="text-sm text-muted-foreground">Append-only log of every compliance workflow action. Used by internal and external audit.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الوقت</TableHead><TableHead>Entity</TableHead><TableHead>Action</TableHead>
            <TableHead>الفاعل</TableHead><TableHead>التفاصيل</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{e.entity_type}</TableCell>
                <TableCell className="text-xs font-medium">{e.action}</TableCell>
                <TableCell className="text-xs font-mono">{e.actor?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate">{Object.keys(e.details ?? {}).length ? JSON.stringify(e.details) : "—"}</TableCell>
              </TableRow>
            ))}
            {!entries.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No activity logged.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
