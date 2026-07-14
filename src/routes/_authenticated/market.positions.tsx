import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ASSET_CLASSES, ASSET_LABEL, deletePosition, fmtMoney, fmtNum, listPositions, upsertPosition, type Position } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/market/positions")({
  component: PositionsPage,
});

type Draft = Partial<Position>;

function PositionsPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: positions = [] } = useQuery({ queryKey: ["market", "positions"], queryFn: listPositions });

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [draft, setDraft] = useState<Draft>({});

  const save = useMutation({
    mutationFn: async (d: Draft) => upsertPosition({ ...d, created_by: user!.id } as never),
    onSuccess: () => { toast.success("Position saved"); qc.invalidateQueries({ queryKey: ["market"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deletePosition,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["market"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ asset_class: "fx", portfolio: "trading", currency: "USD", quantity: 0, price: 0, market_value: 0, notional: 0, duration: 0, convexity: 0, coupon_rate: 0, beta: 1, volatility: 0.1 }); setOpen(true); };
  const openEdit = (p: Position) => { setDraft(p); setOpen(true); };

  const rows = filter === "all" ? positions : positions.filter((p) => p.asset_class === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">المراكز</h2>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All asset classes</SelectItem>
              {ASSET_CLASSES.map((a) => <SelectItem key={a} value={a}>{ASSET_LABEL[a]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New position</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} position</DialogTitle></DialogHeader>
              <div className="grid grid-cols-3 gap-3">
                <F label="Code"><Input value={draft.position_code ?? ""} onChange={(e) => setDraft({ ...draft, position_code: e.target.value })} /></F>
                <F label="الاسم"><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></F>
                <F label="Asset class">
                  <Select value={draft.asset_class ?? "fx"} onValueChange={(v) => setDraft({ ...draft, asset_class: v as Position["asset_class"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ASSET_CLASSES.map((a) => <SelectItem key={a} value={a}>{ASSET_LABEL[a]}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="المحفظة"><Input value={draft.portfolio ?? "trading"} onChange={(e) => setDraft({ ...draft, portfolio: e.target.value })} /></F>
                <F label="Currency"><Input value={draft.currency ?? "USD"} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></F>
                <F label="Quantity"><Input type="number" step="0.0001" value={draft.quantity ?? 0} onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })} /></F>
                <F label="Price"><Input type="number" step="0.000001" value={draft.price ?? 0} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></F>
                <F label="Market value"><Input type="number" step="0.01" value={draft.market_value ?? 0} onChange={(e) => setDraft({ ...draft, market_value: Number(e.target.value) })} /></F>
                <F label="القيمة الاسمية"><Input type="number" step="0.01" value={draft.notional ?? 0} onChange={(e) => setDraft({ ...draft, notional: Number(e.target.value) })} /></F>
                <F label="Volatility (σ)"><Input type="number" step="0.001" value={draft.volatility ?? 0.1} onChange={(e) => setDraft({ ...draft, volatility: Number(e.target.value) })} /></F>
                <F label="Duration (yrs)"><Input type="number" step="0.01" value={draft.duration ?? 0} onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })} /></F>
                <F label="Convexity"><Input type="number" step="0.01" value={draft.convexity ?? 0} onChange={(e) => setDraft({ ...draft, convexity: Number(e.target.value) })} /></F>
                <F label="Coupon rate"><Input type="number" step="0.001" value={draft.coupon_rate ?? 0} onChange={(e) => setDraft({ ...draft, coupon_rate: Number(e.target.value) })} /></F>
                <F label="Maturity"><Input type="date" value={draft.maturity_date ?? ""} onChange={(e) => setDraft({ ...draft, maturity_date: e.target.value || null })} /></F>
                <F label="Beta (equity)"><Input type="number" step="0.01" value={draft.beta ?? 1} onChange={(e) => setDraft({ ...draft, beta: Number(e.target.value) })} /></F>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.position_code || !draft.name}>حفظ</Button>
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
                <TableHead>Class</TableHead>
                <TableHead className="text-right">MV</TableHead>
                <TableHead className="text-right">DV01</TableHead>
                <TableHead className="text-right">Δ 1%</TableHead>
                <TableHead className="text-right">σ</TableHead>
                <TableHead className="text-right">المدة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.position_code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell><Badge variant="secondary">{ASSET_LABEL[p.asset_class]}</Badge></TableCell>
                  <TableCell className="text-right">{fmtMoney(p.market_value, p.currency)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(p.dv01, p.currency)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(p.delta_1pct, p.currency)}</TableCell>
                  <TableCell className="text-right">{fmtNum(p.volatility, 4)}</TableCell>
                  <TableCell className="text-right">{fmtNum(p.duration, 2)}</TableCell>
                  <TableCell className="w-24 text-right">
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={9} className="py-6 text-center text-muted-foreground">No positions yet.</TableCell></TableRow>}
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