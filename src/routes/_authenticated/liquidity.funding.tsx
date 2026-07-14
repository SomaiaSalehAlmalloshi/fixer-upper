import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip,
} from "recharts";
import { useAuth } from "@/lib/auth";
import {
  SOURCE_LABEL, deleteFundingSource, fmtMoney, fmtPct, listFundingSources,
  upsertFundingSource, type FundingSource, type FundingSourceType,
} from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/funding")({
  component: FundingPage,
});

const TYPES: FundingSourceType[] = ["retail_deposits", "wholesale_deposits", "repo", "interbank", "bond", "equity", "other"];
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function FundingPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: sources = [] } = useQuery({ queryKey: ["liq", "funding"], queryFn: listFundingSources });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<FundingSource>>({});

  const save = useMutation({
    mutationFn: (d: Partial<FundingSource>) => upsertFundingSource({ ...d, created_by: user!.id }),
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["liq"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteFundingSource,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["liq"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ source_type: "retail_deposits", currency: "USD", amount: 0, tenor_days: 30, stable: true, asf_factor: 0.95, rsf_factor: 0.5 }); setOpen(true); };
  const openEdit = (s: FundingSource) => { setDraft(s); setOpen(true); };

  const total = sources.reduce((s, x) => s + Number(x.amount), 0);
  const mix = TYPES.map((t) => ({
    name: SOURCE_LABEL[t],
    value: sources.filter((s) => s.source_type === t).reduce((sum, x) => sum + Number(x.amount), 0),
  })).filter((x) => x.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Total funding</div><div className="mt-2 text-2xl font-semibold">{fmtMoney(total)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Stable share</div><div className="mt-2 text-2xl font-semibold">{fmtPct(total ? sources.filter((s) => s.stable).reduce((a, s) => a + Number(s.amount), 0) / total : 0)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Sources</div><div className="mt-2 text-2xl font-semibold">{sources.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Funding mix</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={mix} dataKey="value" nameKey="name" outerRadius={90} label>
                {mix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">مصادر التمويل</h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New source</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} funding source</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="الاسم"><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></F>
                <F label="النوع">
                  <Select value={draft.source_type ?? "retail_deposits"} onValueChange={(v) => setDraft({ ...draft, source_type: v as FundingSourceType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{SOURCE_LABEL[t]}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Counterparty"><Input value={draft.counterparty ?? ""} onChange={(e) => setDraft({ ...draft, counterparty: e.target.value })} /></F>
                <F label="Currency"><Input value={draft.currency ?? "USD"} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></F>
                <F label="المبلغ"><Input type="number" step="0.01" value={draft.amount ?? 0} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></F>
                <F label="Tenor (days)"><Input type="number" value={draft.tenor_days ?? 30} onChange={(e) => setDraft({ ...draft, tenor_days: Number(e.target.value) })} /></F>
                <F label="Stable">
                  <Select value={String(draft.stable ?? true)} onValueChange={(v) => setDraft({ ...draft, stable: v === "true" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="true">نعم</SelectItem><SelectItem value="false">لا</SelectItem></SelectContent>
                  </Select>
                </F>
                <F label="ASF factor (0-1)"><Input type="number" step="0.01" value={draft.asf_factor ?? 0.5} onChange={(e) => setDraft({ ...draft, asf_factor: Number(e.target.value) })} /></F>
                <F label="RSF factor (0-1)"><Input type="number" step="0.01" value={draft.rsf_factor ?? 0.5} onChange={(e) => setDraft({ ...draft, rsf_factor: Number(e.target.value) })} /></F>
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
                <TableHead>النوع</TableHead>
                <TableHead>Ccy</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">Tenor</TableHead>
                <TableHead>Stable</TableHead>
                <TableHead className="text-right">التمويل المستقر المتاح (ASF)</TableHead>
                <TableHead className="text-right">التمويل المستقر المطلوب (RSF)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell><Badge variant="secondary">{SOURCE_LABEL[s.source_type]}</Badge></TableCell>
                  <TableCell>{s.currency}</TableCell>
                  <TableCell className="text-right">{fmtMoney(s.amount, s.currency)}</TableCell>
                  <TableCell className="text-right">{s.tenor_days}d</TableCell>
                  <TableCell>{s.stable ? "نعم" : "—"}</TableCell>
                  <TableCell className="text-right">{fmtPct(Number(s.asf_factor))}</TableCell>
                  <TableCell className="text-right">{fmtPct(Number(s.rsf_factor))}</TableCell>
                  <TableCell className="w-24 text-right">
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!sources.length && <TableRow><TableCell colSpan={9} className="py-6 text-center text-muted-foreground">No funding sources yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block text-xs uppercase text-muted-foreground">{label}</Label>{children}</div>;
}
