import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Play } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { deleteScenario, fmtMoney, listPositions, listScenarios, scenarioPnl, upsertScenario, type Scenario } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/market/scenarios")({
  component: ScenariosPage,
});

type Draft = Partial<Scenario>;

function ScenariosPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: scenarios = [] } = useQuery({ queryKey: ["market", "scenarios"], queryFn: listScenarios });
  const { data: positions = [] } = useQuery({ queryKey: ["market", "positions"], queryFn: listPositions });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});

  const save = useMutation({
    mutationFn: async (d: Draft) => upsertScenario({ ...d, created_by: user!.id } as never),
    onSuccess: () => { toast.success("Scenario saved"); qc.invalidateQueries({ queryKey: ["market", "scenarios"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteScenario,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["market", "scenarios"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const run = useMutation({
    mutationFn: async (s: Scenario) => upsertScenario({ ...s, pnl_impact: scenarioPnl(positions, s) } as never),
    onSuccess: () => { toast.success("Recomputed"); qc.invalidateQueries({ queryKey: ["market", "scenarios"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ fx_shock: 0.05, ir_shock_bp: 100, equity_shock: -0.1, commodity_shock: 0.2 }); setOpen(true); };
  const openEdit = (s: Scenario) => { setDraft(s); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Stress scenarios</h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New scenario</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} scenario</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="الاسم"><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></F>
                <F label="الوصف"><Input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></F>
                <F label="FX shock (decimal)"><Input type="number" step="0.001" value={draft.fx_shock ?? 0} onChange={(e) => setDraft({ ...draft, fx_shock: Number(e.target.value) })} /></F>
                <F label="Rates shift (bp)"><Input type="number" step="1" value={draft.ir_shock_bp ?? 0} onChange={(e) => setDraft({ ...draft, ir_shock_bp: Number(e.target.value) })} /></F>
                <F label="Equity shock (decimal)"><Input type="number" step="0.001" value={draft.equity_shock ?? 0} onChange={(e) => setDraft({ ...draft, equity_shock: Number(e.target.value) })} /></F>
                <F label="Commodity shock (decimal)"><Input type="number" step="0.001" value={draft.commodity_shock ?? 0} onChange={(e) => setDraft({ ...draft, commodity_shock: Number(e.target.value) })} /></F>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => {
                  const pnl = scenarioPnl(positions, {
                    fx_shock: Number(draft.fx_shock ?? 0),
                    ir_shock_bp: Number(draft.ir_shock_bp ?? 0),
                    equity_shock: Number(draft.equity_shock ?? 0),
                    commodity_shock: Number(draft.commodity_shock ?? 0),
                  });
                  save.mutate({ ...draft, pnl_impact: pnl });
                }} disabled={save.isPending || !draft.name}>Save & compute</Button>
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
                <TableHead>الوصف</TableHead>
                <TableHead className="text-right">العملات الأجنبية</TableHead>
                <TableHead className="text-right">Rates (bp)</TableHead>
                <TableHead className="text-right">الأسهم</TableHead>
                <TableHead className="text-right">السلع</TableHead>
                <TableHead className="text-right">الربح والخسارة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{s.description}</TableCell>
                  <TableCell className="text-right">{(Number(s.fx_shock) * 100).toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{Number(s.ir_shock_bp)}</TableCell>
                  <TableCell className="text-right">{(Number(s.equity_shock) * 100).toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{(Number(s.commodity_shock) * 100).toFixed(2)}%</TableCell>
                  <TableCell className={"text-right font-medium " + (Number(s.pnl_impact) < 0 ? "text-destructive" : "")}>{fmtMoney(s.pnl_impact)}</TableCell>
                  <TableCell className="w-32 text-right">
                    {canWrite && <Button size="icon" variant="ghost" title="Recompute" onClick={() => run.mutate(s)}><Play className="h-4 w-4" /></Button>}
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!scenarios.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No scenarios yet.</TableCell></TableRow>}
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