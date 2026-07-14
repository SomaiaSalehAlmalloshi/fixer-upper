import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { BORROWER_TYPES, RATING_SCALE, deleteBorrower, fmtPct, listBorrowers, upsertBorrower, type Borrower } from "@/lib/credit";

export const Route = createFileRoute("/_authenticated/credit/borrowers")({
  component: BorrowersPage,
});

type Draft = Partial<Borrower>;

function BorrowersPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data = [] } = useQuery({ queryKey: ["credit", "borrowers"], queryFn: listBorrowers });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});

  const save = useMutation({
    mutationFn: async (d: Draft) => upsertBorrower({ ...d, created_by: user!.id } as never),
    onSuccess: () => {
      toast.success("Borrower saved");
      qc.invalidateQueries({ queryKey: ["credit"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteBorrower,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["credit"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ borrower_type: "corporate", pd: 0.02 }); setOpen(true); };
  const openEdit = (b: Borrower) => { setDraft(b); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">المقترضون</h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New borrower</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} borrower</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code"><Input value={draft.code ?? ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></Field>
                <Field label="الاسم"><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
                <Field label="النوع">
                  <Select value={draft.borrower_type ?? "corporate"} onValueChange={(v) => setDraft({ ...draft, borrower_type: v as Borrower["borrower_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BORROWER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Industry"><Input value={draft.industry ?? ""} onChange={(e) => setDraft({ ...draft, industry: e.target.value })} /></Field>
                <Field label="Country"><Input value={draft.country ?? ""} onChange={(e) => setDraft({ ...draft, country: e.target.value })} /></Field>
                <Field label="Credit rating">
                  <Select value={draft.credit_rating ?? ""} onValueChange={(v) => setDraft({ ...draft, credit_rating: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{RATING_SCALE.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="PD (0-1)"><Input type="number" step="0.001" min={0} max={1} value={draft.pd ?? 0.02} onChange={(e) => setDraft({ ...draft, pd: Number(e.target.value) })} /></Field>
                <Field label="Annual revenue"><Input type="number" step="0.01" value={draft.annual_revenue ?? ""} onChange={(e) => setDraft({ ...draft, annual_revenue: e.target.value ? Number(e.target.value) : null })} /></Field>
                <Field label="ملاحظات" full><Textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.code || !draft.name}>حفظ</Button>
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
                <TableHead>Code</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead className="text-right">احتمالية التعثّر (PD)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.code}</TableCell>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.borrower_type}</TableCell>
                  <TableCell>{b.industry ?? "—"}</TableCell>
                  <TableCell>{b.country ?? "—"}</TableCell>
                  <TableCell>{b.credit_rating ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmtPct(b.pd)}</TableCell>
                  <TableCell className="w-24 text-right">
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(b.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No borrowers yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="mb-1 block text-xs uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}