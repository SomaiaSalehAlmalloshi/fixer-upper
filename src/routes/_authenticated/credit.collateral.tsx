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
import { Plus, Trash2, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { COLLATERAL_TYPES, deleteCollateral, fmtDate, fmtMoney, fmtPct, listCollateral, listLoans, upsertCollateral, type Collateral } from "@/lib/credit";

export const Route = createFileRoute("/_authenticated/credit/collateral")({
  component: Page,
});

type Draft = Partial<Collateral>;

function Page() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: items = [] } = useQuery({ queryKey: ["credit", "collateral"], queryFn: listCollateral });
  const { data: loans = [] } = useQuery({ queryKey: ["credit", "loans"], queryFn: listLoans });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});

  const save = useMutation({
    mutationFn: async (d: Draft) => upsertCollateral({ ...d, created_by: user!.id, loan_id: d.loan_id! } as never),
    onSuccess: () => { toast.success("Collateral saved"); qc.invalidateQueries({ queryKey: ["credit"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteCollateral,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["credit"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ collateral_type: "real_estate", haircut: 0.2, market_value: 0, currency: "USD" }); setOpen(true); };
  const openEdit = (c: Collateral) => { setDraft(c); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">الضمانات</h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New collateral</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} collateral</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="Loan">
                  <Select value={draft.loan_id ?? ""} onValueChange={(v) => setDraft({ ...draft, loan_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{loans.map((l) => <SelectItem key={l.id} value={l.id}>{l.loan_number}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="النوع">
                  <Select value={draft.collateral_type ?? "other"} onValueChange={(v) => setDraft({ ...draft, collateral_type: v as Collateral["collateral_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COLLATERAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="الوصف" full><Input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></F>
                <F label="Market value"><Input type="number" step="0.01" value={draft.market_value ?? 0} onChange={(e) => setDraft({ ...draft, market_value: Number(e.target.value) })} /></F>
                <F label="Haircut (0-1)"><Input type="number" step="0.01" value={draft.haircut ?? 0.2} onChange={(e) => setDraft({ ...draft, haircut: Number(e.target.value) })} /></F>
                <F label="Currency"><Input value={draft.currency ?? "USD"} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></F>
                <F label="Valuation date"><Input type="date" value={draft.valuation_date ?? ""} onChange={(e) => setDraft({ ...draft, valuation_date: e.target.value || null })} /></F>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.loan_id}>حفظ</Button>
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
                <TableHead>Loan</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead className="text-right">Market value</TableHead>
                <TableHead className="text-right">Haircut</TableHead>
                <TableHead className="text-right">Eligible</TableHead>
                <TableHead>Valued</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => {
                const l = (c as { loan?: { loan_number: string } | null }).loan;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{l?.loan_number ?? "—"}</TableCell>
                    <TableCell>{c.collateral_type.replace("_", " ")}</TableCell>
                    <TableCell>{c.description ?? "—"}</TableCell>
                    <TableCell className="text-right">{fmtMoney(c.market_value, c.currency)}</TableCell>
                    <TableCell className="text-right">{fmtPct(c.haircut)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(c.eligible_value, c.currency)}</TableCell>
                    <TableCell>{fmtDate(c.valuation_date)}</TableCell>
                    <TableCell className="w-24 text-right">
                      {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>}
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!items.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No collateral yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="mb-1 block text-xs uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}