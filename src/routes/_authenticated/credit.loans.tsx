import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LOAN_STATUSES, deleteLoan, fmtMoney, fmtPct, listBorrowers, listLoans, upsertLoan, type Loan } from "@/lib/credit";

export const Route = createFileRoute("/_authenticated/credit/loans")({
  component: LoansPage,
});

type Draft = Partial<Loan>;

function LoansPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: loans = [] } = useQuery({ queryKey: ["credit", "loans"], queryFn: listLoans });
  const { data: borrowers = [] } = useQuery({ queryKey: ["credit", "borrowers"], queryFn: listBorrowers });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});

  const save = useMutation({
    mutationFn: async (d: Draft) => upsertLoan({ ...d, created_by: user!.id } as never),
    onSuccess: () => { toast.success("Loan saved"); qc.invalidateQueries({ queryKey: ["credit"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["credit"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ status: "active", currency: "USD", ccf: 0.75, lgd: 0.45, principal: 0, outstanding: 0, undrawn: 0, interest_rate: 0.05, days_past_due: 0, product_type: "Term Loan" }); setOpen(true); };
  const openEdit = (l: Loan) => { setDraft(l); setOpen(true); };

  const statusVariant = (s: Loan["status"]) => s === "default" ? "destructive" : s === "written_off" ? "outline" : s === "closed" ? "secondary" : "default";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">القروض</h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New loan</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} loan</DialogTitle></DialogHeader>
              <div className="grid grid-cols-3 gap-3">
                <F label="Loan #"><Input value={draft.loan_number ?? ""} onChange={(e) => setDraft({ ...draft, loan_number: e.target.value })} /></F>
                <F label="Borrower">
                  <Select value={draft.borrower_id ?? ""} onValueChange={(v) => setDraft({ ...draft, borrower_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{borrowers.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} — {b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Product"><Input value={draft.product_type ?? ""} onChange={(e) => setDraft({ ...draft, product_type: e.target.value })} /></F>
                <F label="Principal"><Input type="number" step="0.01" value={draft.principal ?? 0} onChange={(e) => setDraft({ ...draft, principal: Number(e.target.value) })} /></F>
                <F label="Outstanding"><Input type="number" step="0.01" value={draft.outstanding ?? 0} onChange={(e) => setDraft({ ...draft, outstanding: Number(e.target.value) })} /></F>
                <F label="Undrawn"><Input type="number" step="0.01" value={draft.undrawn ?? 0} onChange={(e) => setDraft({ ...draft, undrawn: Number(e.target.value) })} /></F>
                <F label="CCF (0-1)"><Input type="number" step="0.01" value={draft.ccf ?? 0.75} onChange={(e) => setDraft({ ...draft, ccf: Number(e.target.value) })} /></F>
                <F label="LGD (0-1)"><Input type="number" step="0.01" value={draft.lgd ?? 0.45} onChange={(e) => setDraft({ ...draft, lgd: Number(e.target.value) })} /></F>
                <F label="PD override"><Input type="number" step="0.001" value={draft.pd_override ?? ""} onChange={(e) => setDraft({ ...draft, pd_override: e.target.value ? Number(e.target.value) : null })} /></F>
                <F label="Interest rate"><Input type="number" step="0.001" value={draft.interest_rate ?? 0} onChange={(e) => setDraft({ ...draft, interest_rate: Number(e.target.value) })} /></F>
                <F label="Currency"><Input value={draft.currency ?? "USD"} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></F>
                <F label="Days past due"><Input type="number" value={draft.days_past_due ?? 0} onChange={(e) => setDraft({ ...draft, days_past_due: Number(e.target.value) })} /></F>
                <F label="Disbursed"><Input type="date" value={draft.disbursement_date ?? ""} onChange={(e) => setDraft({ ...draft, disbursement_date: e.target.value || null })} /></F>
                <F label="Maturity"><Input type="date" value={draft.maturity_date ?? ""} onChange={(e) => setDraft({ ...draft, maturity_date: e.target.value || null })} /></F>
                <F label="الحالة">
                  <Select value={draft.status ?? "active"} onValueChange={(v) => setDraft({ ...draft, status: v as Loan["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LOAN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.loan_number || !draft.borrower_id}>حفظ</Button>
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
                <TableHead>Loan #</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">التعرّض عند التعثّر (EAD)</TableHead>
                <TableHead className="text-right">الخسارة عند التعثّر (LGD)</TableHead>
                <TableHead className="text-right">EL</TableHead>
                <TableHead className="text-right">DPD</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((l) => {
                const b = (l as { borrower?: { code: string; name: string } | null }).borrower;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.loan_number}</TableCell>
                    <TableCell>{b ? `${b.code} — ${b.name}` : "—"}</TableCell>
                    <TableCell>{l.product_type}</TableCell>
                    <TableCell className="text-right">{fmtMoney(l.outstanding, l.currency)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(l.ead, l.currency)}</TableCell>
                    <TableCell className="text-right">{fmtPct(l.lgd)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(l.expected_loss, l.currency)}</TableCell>
                    <TableCell className="text-right">{l.days_past_due}</TableCell>
                    <TableCell><Badge variant={statusVariant(l.status)}>{l.status}</Badge></TableCell>
                    <TableCell className="w-24 text-right">
                      {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>}
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loans.length && <TableRow><TableCell colSpan={10} className="py-6 text-center text-muted-foreground">No loans yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}