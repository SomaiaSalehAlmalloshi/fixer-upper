import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { listWarnings, updateWarningStatus } from "@/lib/credit";

export const Route = createFileRoute("/_authenticated/credit/early-warning")({
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const { user, canWrite } = useAuth();
  const { data: items = [] } = useQuery({ queryKey: ["credit", "warnings"], queryFn: listWarnings });
  const update = useMutation({
    mutationFn: async (p: { id: string; status: "acknowledged" | "resolved" | "false_positive" }) => updateWarningStatus(p.id, p.status, user!.id),
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["credit", "warnings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = items.filter((w) => w.status === "open").length;
  const critical = items.filter((w) => w.severity === "critical" && w.status === "open").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total signals" value={items.length} />
        <Stat label="فتح" value={open} />
        <Stat label="Critical open" value={critical} accent />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Signal</TableHead>
                <TableHead>مستوى الخطورة</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Loan</TableHead>
                <TableHead>الرسالة</TableHead>
                <TableHead>Triggered</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => {
                const b = (w as { borrower?: { code: string; name: string } | null }).borrower;
                const l = (w as { loan?: { loan_number: string } | null }).loan;
                const sevVar = w.severity === "critical" || w.severity === "high" ? "destructive" : "secondary";
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.signal_type}</TableCell>
                    <TableCell><Badge variant={sevVar}>{w.severity}</Badge></TableCell>
                    <TableCell>{b ? `${b.code} — ${b.name}` : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{l?.loan_number ?? "—"}</TableCell>
                    <TableCell className="max-w-md truncate">{w.message ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(w.triggered_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={w.status === "open" ? "default" : "outline"}>{w.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canWrite && w.status === "open" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: w.id, status: "acknowledged" })}>Ack</Button>
                          <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: w.id, status: "resolved" })}>Resolve</Button>
                          <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: w.id, status: "false_positive" })}>False</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!items.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No signals yet. Increase a loan's Days Past Due above 30 to trigger one.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}