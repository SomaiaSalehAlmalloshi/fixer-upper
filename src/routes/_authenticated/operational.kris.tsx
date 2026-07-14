import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { KRI_COLOR, deleteKri, listKris, upsertKri, type Kri } from "@/lib/operational";

export const Route = createFileRoute("/_authenticated/operational/kris")({
  component: KrisPage,
});

function KrisPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: kris = [] } = useQuery({ queryKey: ["op", "kris"], queryFn: listKris });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Kri>>({});

  const save = useMutation({
    mutationFn: (d: Partial<Kri>) => upsertKri({ ...d, created_by: user!.id }),
    onSuccess: () => { toast.success("KRI saved"); qc.invalidateQueries({ queryKey: ["op"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteKri,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["op"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setDraft({
      code: `KRI-${Date.now().toString().slice(-4)}`,
      category: "operational",
      unit: "count",
      frequency: "monthly",
      current_value: 0,
      threshold_amber: 5,
      threshold_red: 10,
      higher_is_worse: true,
    });
    setOpen(true);
  };
  const openEdit = (k: Kri) => { setDraft(k); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">Key Risk Indicators</h2>
          <p className="text-sm text-muted-foreground">Quantitative metrics that signal changes in operational-risk exposure.</p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New KRI</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} KRI</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="Code"><Input value={draft.code ?? ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></F>
                <F label="الاسم"><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></F>
                <F label="الفئة"><Input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></F>
                <F label="Unit"><Input value={draft.unit ?? ""} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></F>
                <F label="Frequency"><Input value={draft.frequency ?? ""} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })} /></F>
                <F label="المالك"><Input value={draft.owner ?? ""} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></F>
                <F label="Current value">
                  <Input type="number" step="0.01" value={draft.current_value ?? 0} onChange={(e) => setDraft({ ...draft, current_value: Number(e.target.value) })} />
                </F>
                <F label="Amber threshold">
                  <Input type="number" step="0.01" value={draft.threshold_amber ?? 0} onChange={(e) => setDraft({ ...draft, threshold_amber: Number(e.target.value) })} />
                </F>
                <F label="Red threshold">
                  <Input type="number" step="0.01" value={draft.threshold_red ?? 0} onChange={(e) => setDraft({ ...draft, threshold_red: Number(e.target.value) })} />
                </F>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={draft.higher_is_worse ?? true} onCheckedChange={(v) => setDraft({ ...draft, higher_is_worse: v })} />
                  <Label className="text-sm">Higher value is worse</Label>
                </div>
                <div className="col-span-2">
                  <F label="ملاحظات"><Textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></F>
                </div>
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
        <CardHeader><CardTitle>مؤشرات المخاطر الرئيسية</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>المالك</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Amber</TableHead>
                <TableHead className="text-right">Red</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {kris.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-mono text-xs">{k.code}</TableCell>
                  <TableCell>{k.name}</TableCell>
                  <TableCell>{k.owner ?? "—"}</TableCell>
                  <TableCell className="text-right">{k.current_value} <span className="text-xs text-muted-foreground">{k.unit}</span></TableCell>
                  <TableCell className="text-right">{k.threshold_amber}</TableCell>
                  <TableCell className="text-right">{k.threshold_red}</TableCell>
                  <TableCell><Badge className={KRI_COLOR[k.status]}>{k.status.toUpperCase()}</Badge></TableCell>
                  <TableCell className="w-24 text-right">
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(k)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(k.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!kris.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No KRIs defined.</TableCell></TableRow>}
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
