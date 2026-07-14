import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { deleteRcsa, listRcsa, riskLevel, upsertRcsa, type Rcsa } from "@/lib/operational";

export const Route = createFileRoute("/_authenticated/operational/rcsa")({
  component: RcsaPage,
});

const SCORES = [1, 2, 3, 4, 5];

function RcsaPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: rows = [] } = useQuery({ queryKey: ["op", "rcsa"], queryFn: listRcsa });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Rcsa>>({});

  const save = useMutation({
    mutationFn: (d: Partial<Rcsa>) => upsertRcsa({ ...d, created_by: user!.id }),
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["op"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteRcsa,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["op"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setDraft({
      inherent_likelihood: 3, inherent_impact: 3,
      residual_likelihood: 2, residual_impact: 2,
      control_effectiveness: 3,
    });
    setOpen(true);
  };
  const openEdit = (r: Rcsa) => { setDraft(r); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">Risk & Control Self-Assessment</h2>
          <p className="text-sm text-muted-foreground">Business-line self-assessment of inherent risk, controls and residual exposure.</p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Assessment</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} RCSA</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="Process"><Input value={draft.process_name ?? ""} onChange={(e) => setDraft({ ...draft, process_name: e.target.value })} /></F>
                <F label="المالك"><Input value={draft.owner ?? ""} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></F>
                <div className="col-span-2">
                  <F label="Risk description"><Textarea rows={2} value={draft.risk_description ?? ""} onChange={(e) => setDraft({ ...draft, risk_description: e.target.value })} /></F>
                </div>
                <ScoreField label="Inherent likelihood" value={draft.inherent_likelihood} onChange={(v) => setDraft({ ...draft, inherent_likelihood: v })} />
                <ScoreField label="Inherent impact" value={draft.inherent_impact} onChange={(v) => setDraft({ ...draft, inherent_impact: v })} />
                <div className="col-span-2">
                  <F label="Control description"><Textarea rows={2} value={draft.control_description ?? ""} onChange={(e) => setDraft({ ...draft, control_description: e.target.value })} /></F>
                </div>
                <ScoreField label="Control effectiveness" value={draft.control_effectiveness} onChange={(v) => setDraft({ ...draft, control_effectiveness: v })} />
                <ScoreField label="Residual likelihood" value={draft.residual_likelihood} onChange={(v) => setDraft({ ...draft, residual_likelihood: v })} />
                <ScoreField label="Residual impact" value={draft.residual_impact} onChange={(v) => setDraft({ ...draft, residual_impact: v })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.process_name || !draft.risk_description}>حفظ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Assessments</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Process</TableHead>
                <TableHead>المخاطر</TableHead>
                <TableHead>المالك</TableHead>
                <TableHead className="text-right">Inherent</TableHead>
                <TableHead className="text-right">Control</TableHead>
                <TableHead className="text-right">Residual</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const lvl = riskLevel(r.residual_score);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.process_name}</TableCell>
                    <TableCell className="max-w-sm truncate text-sm">{r.risk_description}</TableCell>
                    <TableCell>{r.owner ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.inherent_score}</TableCell>
                    <TableCell className="text-right">{r.control_effectiveness}/5</TableCell>
                    <TableCell className={"text-right font-semibold " + lvl.cls}>{r.residual_score}</TableCell>
                    <TableCell className="w-24 text-right">
                      {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>}
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No assessments yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreField({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number) => void }) {
  return (
    <F label={label}>
      <div className="flex gap-1">
        {SCORES.map((n) => (
          <Button
            key={n}
            size="sm"
            variant={value === n ? "default" : "outline"}
            className="w-10"
            onClick={() => onChange(n)}
            type="button"
          >
            {n}
          </Button>
        ))}
      </div>
    </F>
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
