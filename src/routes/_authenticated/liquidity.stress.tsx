import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Play, Trash2 } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth";
import {
  applyStress, deleteStressScenario, fmtMoney, fmtPct, listCashFlows,
  listFundingSources, listHqla, listStressScenarios, ratioColor,
  upsertStressScenario, type StressScenario,
} from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/stress")({
  component: StressPage,
});

function StressPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: hqla = [] } = useQuery({ queryKey: ["liq", "hqla"], queryFn: listHqla });
  const { data: flows = [] } = useQuery({ queryKey: ["liq", "cashflows"], queryFn: listCashFlows });
  const { data: _sources = [] } = useQuery({ queryKey: ["liq", "funding"], queryFn: listFundingSources });
  const { data: scenarios = [] } = useQuery({ queryKey: ["liq", "stress"], queryFn: listStressScenarios });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<StressScenario>>({});

  const save = useMutation({
    mutationFn: async (d: Partial<StressScenario>) => {
      const res = applyStress(hqla, flows, {
        retail_runoff: d.retail_runoff ?? 0.1,
        wholesale_runoff: d.wholesale_runoff ?? 0.4,
        extra_haircut: d.extra_haircut ?? 0.05,
        inflow_haircut: d.inflow_haircut ?? 0.25,
      });
      return upsertStressScenario({
        ...d,
        created_by: user!.id,
        results: { lcr: res.lcr, hqla: res.hqla.total, net: res.cashflows.net },
      });
    },
    onSuccess: () => { toast.success("Scenario saved"); qc.invalidateQueries({ queryKey: ["liq", "stress"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteStressScenario,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["liq", "stress"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ name: "", retail_runoff: 0.10, wholesale_runoff: 0.40, extra_haircut: 0.05, inflow_haircut: 0.25 }); setOpen(true); };

  const chart = useMemo(() => scenarios.map((s) => {
    const r = (s.results ?? {}) as { lcr?: number; hqla?: number; net?: number };
    return { name: s.name, lcr: (r.lcr ?? 0) * 100, hqla: r.hqla ?? 0, net: r.net ?? 0 };
  }), [scenarios]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Liquidity stress scenarios</h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New scenario</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>New stress scenario</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="الاسم"><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></F>
                <F label="الوصف"><Input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></F>
                <F label="Retail run-off (0-1)"><Input type="number" step="0.01" value={draft.retail_runoff ?? 0.1} onChange={(e) => setDraft({ ...draft, retail_runoff: Number(e.target.value) })} /></F>
                <F label="Wholesale run-off (0-1)"><Input type="number" step="0.01" value={draft.wholesale_runoff ?? 0.4} onChange={(e) => setDraft({ ...draft, wholesale_runoff: Number(e.target.value) })} /></F>
                <F label="Extra HQLA haircut (0-1)"><Input type="number" step="0.01" value={draft.extra_haircut ?? 0.05} onChange={(e) => setDraft({ ...draft, extra_haircut: Number(e.target.value) })} /></F>
                <F label="Inflow haircut (0-1)"><Input type="number" step="0.01" value={draft.inflow_haircut ?? 0.25} onChange={(e) => setDraft({ ...draft, inflow_haircut: Number(e.target.value) })} /></F>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.name}><Play className="mr-2 h-4 w-4" /> Run & save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {chart.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Stressed LCR by scenario</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => v.toFixed(0) + "%"} />
                <Tooltip formatter={(v: number) => v.toFixed(1) + "%"} />
                <Legend />
                <Bar dataKey="lcr" fill="var(--chart-2)" name="LCR (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead className="text-right">Retail run-off</TableHead>
                <TableHead className="text-right">Wholesale run-off</TableHead>
                <TableHead className="text-right">Extra haircut</TableHead>
                <TableHead className="text-right">Inflow haircut</TableHead>
                <TableHead className="text-right">Stressed LCR</TableHead>
                <TableHead className="text-right">HQLA</TableHead>
                <TableHead className="text-right">Net outflow</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((s) => {
                const r = (s.results ?? {}) as { lcr?: number; hqla?: number; net?: number };
                return (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right">{fmtPct(Number(s.retail_runoff))}</TableCell>
                    <TableCell className="text-right">{fmtPct(Number(s.wholesale_runoff))}</TableCell>
                    <TableCell className="text-right">{fmtPct(Number(s.extra_haircut))}</TableCell>
                    <TableCell className="text-right">{fmtPct(Number(s.inflow_haircut))}</TableCell>
                    <TableCell className={"text-right font-semibold " + ratioColor(r.lcr ?? 0)}>{r.lcr != null && isFinite(r.lcr) ? fmtPct(r.lcr, 0) : "—"}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.hqla ?? 0)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.net ?? 0)}</TableCell>
                    <TableCell className="w-16 text-right">
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!scenarios.length && <TableRow><TableCell colSpan={9} className="py-6 text-center text-muted-foreground">No stress scenarios yet.</TableCell></TableRow>}
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
