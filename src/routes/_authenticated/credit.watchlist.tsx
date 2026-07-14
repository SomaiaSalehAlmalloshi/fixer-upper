import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SEVERITIES, addWatch, listBorrowers, listLoans, listWatch, resolveWatch } from "@/lib/credit";

export const Route = createFileRoute("/_authenticated/credit/watchlist")({
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const { user, canWrite } = useAuth();
  const { data: items = [] } = useQuery({ queryKey: ["credit", "watch"], queryFn: listWatch });
  const { data: borrowers = [] } = useQuery({ queryKey: ["credit", "borrowers"], queryFn: listBorrowers });
  const { data: loans = [] } = useQuery({ queryKey: ["credit", "loans"], queryFn: listLoans });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ borrower_id?: string; loan_id?: string; severity: "low"|"medium"|"high"|"critical"; reason: string; resolution?: string }>({
    severity: "medium", reason: "",
  });
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const add = useMutation({
    mutationFn: async () => addWatch({
      added_by: user!.id,
      borrower_id: draft.borrower_id || null,
      loan_id: draft.loan_id || null,
      severity: draft.severity,
      reason: draft.reason,
    }),
    onSuccess: () => { toast.success("Added"); qc.invalidateQueries({ queryKey: ["credit", "watch"] }); setOpen(false); setDraft({ severity: "medium", reason: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolve = useMutation({
    mutationFn: async (id: string) => resolveWatch(id, resolution),
    onSuccess: () => { toast.success("Resolved"); qc.invalidateQueries({ queryKey: ["credit", "watch"] }); setResolvingId(null); setResolution(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Watch List</h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add to watch list</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add watch entry</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Borrower</Label>
                  <Select value={draft.borrower_id ?? ""} onValueChange={(v) => setDraft({ ...draft, borrower_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{borrowers.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} — {b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Loan (optional)</Label>
                  <Select value={draft.loan_id ?? ""} onValueChange={(v) => setDraft({ ...draft, loan_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{loans.map((l) => <SelectItem key={l.id} value={l.id}>{l.loan_number}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">مستوى الخطورة</Label>
                  <Select value={draft.severity} onValueChange={(v) => setDraft({ ...draft, severity: v as typeof draft.severity })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Reason</Label>
                  <Textarea rows={3} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => add.mutate()} disabled={!draft.reason || add.isPending}>إضافة</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>مستوى الخطورة</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Loan</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => {
                const b = (w as { borrower?: { code: string; name: string } | null }).borrower;
                const l = (w as { loan?: { loan_number: string } | null }).loan;
                const sevVar = w.severity === "critical" ? "destructive" : w.severity === "high" ? "destructive" : "secondary";
                return (
                  <TableRow key={w.id}>
                    <TableCell><Badge variant={sevVar}>{w.severity}</Badge></TableCell>
                    <TableCell>{b ? `${b.code} — ${b.name}` : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{l?.loan_number ?? "—"}</TableCell>
                    <TableCell className="max-w-md truncate">{w.reason}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(w.added_at).toLocaleDateString()}</TableCell>
                    <TableCell>{w.resolved_at ? <Badge variant="outline">Resolved</Badge> : <Badge>فتح</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {!w.resolved_at && canWrite && (
                        <Dialog open={resolvingId === w.id} onOpenChange={(v) => setResolvingId(v ? w.id : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Check className="mr-1 h-4 w-4" />Resolve</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Resolve watch entry</DialogTitle></DialogHeader>
                            <Input placeholder="Resolution note" value={resolution} onChange={(e) => setResolution(e.target.value)} />
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setResolvingId(null)}>إلغاء</Button>
                              <Button onClick={() => resolve.mutate(w.id)} disabled={!resolution}>Resolve</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!items.length && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Watch list is empty.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}