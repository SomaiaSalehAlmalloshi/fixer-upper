import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUDIENCE_LABEL, FORMAT_LABEL, listRuns, type Audience } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/reporting/history")({
  component: History,
});

function History() {
  const { data: runs = [] } = useQuery({ queryKey: ["report-runs"], queryFn: () => listRuns(200) });
  return (
    <Card>
      <CardHeader><CardTitle>Report history</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الوقت</TableHead><TableHead>التقرير</TableHead><TableHead>Audience</TableHead>
            <TableHead>Format</TableHead><TableHead>File</TableHead>
            <TableHead>Distribution</TableHead><TableHead>الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(r.run_at).toLocaleString()}</TableCell>
                <TableCell><Link to="/reporting/$key" params={{ key: r.report_key }} className="hover:underline">{r.report_name}</Link></TableCell>
                <TableCell className="text-xs">{AUDIENCE_LABEL[r.audience as Audience] ?? r.audience}</TableCell>
                <TableCell className="text-xs">{FORMAT_LABEL[r.format]}</TableCell>
                <TableCell className="text-xs font-mono">{r.file_name ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {r.distributed
                    ? <span>{r.recipients.length} recipient(s){r.distribution_note ? ` — ${r.distribution_note}` : ""}</span>
                    : <span className="text-muted-foreground">Not distributed</span>}
                </TableCell>
                <TableCell>
                  <Badge className={r.status === "success" ? "bg-emerald-500/15 text-emerald-500" : r.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted"}>{r.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {!runs.length && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No exports yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
