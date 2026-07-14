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
  TIER_COLOR, TIER_LABEL, computeHqla, deleteHqla, fmtMoney, fmtPct,
  listHqla, upsertHqla, type Hqla, type HqlaTier,
} from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/hqla")({
  component: HqlaPage,
});

const TIERS: HqlaTier[] = ["level1", "level2a", "level2b"];

function HqlaPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: assets = [] } = useQuery({ queryKey: ["liq", "hqla"], queryFn: listHqla });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Hqla>>({});

  const save = useMutation({
    mutationFn: (d: Partial<Hqla>) => upsertHqla({ ...d, created_by: user!.id }),
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["liq"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteHqla,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["liq"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ tier: "level1", currency: "USD", market_value: 0, haircut: 0, encumbered: false }); setOpen(true); };
  const openEdit = (a: Hqla) => { setDraft(a); setOpen(true); };

  const totals = computeHqla(assets);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Total HQLA" value={fmtMoney(totals.total)} />
        <Kpi label="Level 1" value={fmtMoney(totals.level1)} />
        <Kpi label="Level 2A" value={fmtMoney(totals.level2a)} />
        <Kpi label="Level 2B (capped)" value={fmtMoney(totals.l2b_capped)} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">HQLA Register</h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New asset</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} HQLA asset</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="الاسم"><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></F>
                <F label="Tier">
                  <Select value={draft.tier ?? "level1"} onValueChange={(v) => setDraft({ ...draft, tier: v as HqlaTier })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIERS.map((t) => <SelectItem key={t} value={t}>{TIER_LABEL[t]}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Currency"><Input value={draft.currency ?? "USD"} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></F>
                <F label="Market value"><Input type="number" step="0.01" value={draft.market_value ?? 0} onChange={(e) => setDraft({ ...draft, market_value: Number(e.target.value) })} /></F>
                <F label="Haircut (0-1)"><Input type="number" step="0.01" value={draft.haircut ?? 0} onChange={(e) => setDraft({ ...draft, haircut: Number(e.target.value) })} /></F>
                <F label="Encumbered">
                  <Select value={String(draft.encumbered ?? false)} onValueChange={(v) => setDraft({ ...draft, encumbered: v === "true" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="false">لا</SelectItem><SelectItem value="true">نعم</SelectItem></SelectContent>
                  </Select>
                </F>
                <div className="col-span-2"><F label="ملاحظات"><Input value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></F></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.name}>حفظ</Button>
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
                <TableHead>الاسم</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Ccy</TableHead>
                <TableHead className="text-right">Market value</TableHead>
                <TableHead className="text-right">Haircut</TableHead>
                <TableHead className="text-right">Eligible</TableHead>
                <TableHead>Enc.</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell><Badge className={TIER_COLOR[a.tier]}>{TIER_LABEL[a.tier]}</Badge></TableCell>
                  <TableCell>{a.currency}</TableCell>
                  <TableCell className="text-right">{fmtMoney(a.market_value, a.currency)}</TableCell>
                  <TableCell className="text-right">{fmtPct(Number(a.haircut))}</TableCell>
                  <TableCell className="text-right">{fmtMoney(a.eligible_value, a.currency)}</TableCell>
                  <TableCell>{a.encumbered ? "نعم" : "—"}</TableCell>
                  <TableCell className="w-24 text-right">
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!assets.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No HQLA assets yet.</TableCell></TableRow>}
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
