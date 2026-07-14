import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  BUCKETS, BUCKET_LABEL, deleteCashFlow, fmtMoney, fmtPct, listCashFlows,
  upsertCashFlow, type CashFlow, type LiqBucket, type LiqDirection,
} from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/cashflow")({
  component: CashFlowPage,
});

const CATEGORIES = ["retail_deposits", "wholesale_deposits", "loans", "securities", "interbank", "operational", "other"];

function CashFlowPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: flows = [] } = useQuery({ queryKey: ["liq", "cashflows"], queryFn: listCashFlows });

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [draft, setDraft] = useState<Partial<CashFlow>>({});

  const save = useMutation({
    mutationFn: (d: Partial<CashFlow>) => upsertCashFlow({ ...d, created_by: user!.id }),
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["liq"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteCashFlow,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["liq"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ direction: "outflow", bucket: "1m", category: "retail_deposits", currency: "USD", amount: 0, stress_factor: 1, cashflow_date: new Date().toISOString().slice(0, 10) }); setOpen(true); };
  const openEdit = (c: CashFlow) => { setDraft(c); setOpen(true); };

  const rows = filter === "all" ? flows : flows.filter((f) => f.direction === filter);
  const totalIn = flows.filter((f) => f.direction === "inflow").reduce((s, f) => s + Number(f.amount), 0);
  const totalOut = flows.filter((f) => f.direction === "outflow").reduce((s, f) => s + Number(f.amount), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Total inflows" value={fmtMoney(totalIn)} />
        <Kpi label="Total outflows" value={fmtMoney(totalOut)} />
        <Kpi label="Net" value={fmtMoney(totalIn - totalOut)} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Cash flows</h2>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="inflow">Inflows</SelectItem>
              <SelectItem value="outflow">Outflows</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New flow</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} cash flow</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="الوصف"><Input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></F>
                <F label="Counterparty"><Input value={draft.counterparty ?? ""} onChange={(e) => setDraft({ ...draft, counterparty: e.target.value })} /></F>
                <F label="Direction">
                  <Select value={draft.direction ?? "outflow"} onValueChange={(v) => setDraft({ ...draft, direction: v as LiqDirection })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="inflow">التدفق الداخل</SelectItem><SelectItem value="outflow">التدفق الخارج</SelectItem></SelectContent>
                  </Select>
                </F>
                <F label="الشريحة">
                  <Select value={draft.bucket ?? "1m"} onValueChange={(v) => setDraft({ ...draft, bucket: v as LiqBucket })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BUCKETS.map((b) => <SelectItem key={b} value={b}>{BUCKET_LABEL[b]}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="الفئة">
                  <Select value={draft.category ?? "other"} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Currency"><Input value={draft.currency ?? "USD"} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></F>
                <F label="المبلغ"><Input type="number" step="0.01" value={draft.amount ?? 0} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></F>
                <F label="Stress factor (0-1)"><Input type="number" step="0.01" value={draft.stress_factor ?? 1} onChange={(e) => setDraft({ ...draft, stress_factor: Number(e.target.value) })} /></F>
                <F label="التاريخ"><Input type="date" value={draft.cashflow_date ?? ""} onChange={(e) => setDraft({ ...draft, cashflow_date: e.target.value })} /></F>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.description}>حفظ</Button>
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
                <TableHead>التاريخ</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>Dir</TableHead>
                <TableHead>الشريحة</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">الضغط</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-xs">{f.cashflow_date}</TableCell>
                  <TableCell>{f.description}</TableCell>
                  <TableCell><Badge variant={f.direction === "inflow" ? "secondary" : "destructive"}>{f.direction}</Badge></TableCell>
                  <TableCell>{BUCKET_LABEL[f.bucket]}</TableCell>
                  <TableCell className="text-xs">{f.category}</TableCell>
                  <TableCell className="text-right">{fmtMoney(f.amount, f.currency)}</TableCell>
                  <TableCell className="text-right">{fmtPct(Number(f.stress_factor))}</TableCell>
                  <TableCell className="w-24 text-right">
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(f.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No cash flows yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></CardContent></Card>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block text-xs uppercase text-muted-foreground">{label}</Label>{children}</div>;
}
