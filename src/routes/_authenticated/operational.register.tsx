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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { deleteRisk, listRiskRegister, riskLevel, upsertRisk, type RiskItem, type RiskStatus } from "@/lib/operational";

export const Route = createFileRoute("/_authenticated/operational/register")({
  component: RegisterPage,
});

const STATUSES: RiskStatus[] = ["open", "mitigated", "accepted", "transferred", "closed"];
const CATEGORIES = ["المخاطر التشغيلية", "الامتثال", "Strategic", "Financial", "Reputational", "Regulatory", "Technology", "People"];
const SCORES = [1, 2, 3, 4, 5];

function RegisterPage() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: rows = [] } = useQuery({ queryKey: ["op", "risks"], queryFn: listRiskRegister });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<RiskItem>>({});

  const save = useMutation({
    mutationFn: (d: Partial<RiskItem>) => upsertRisk({ ...d, created_by: user!.id }),
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["op"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteRisk,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["op"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setDraft({
      risk_code: `RSK-${Date.now().toString().slice(-4)}`,
      category: "المخاطر التشغيلية",
      likelihood: 3, impact: 3,
      residual_likelihood: 2, residual_impact: 2,
      status: "open",
    });
    setOpen(true);
  };
  const openEdit = (r: RiskItem) => { setDraft(r); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">Enterprise Risk Register</h2>
          <p className="text-sm text-muted-foreground">Consolidated register of all identified risks with inherent and residual scores.</p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New risk</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} risk</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="Code"><Input value={draft.risk_code ?? ""} onChange={(e) => setDraft({ ...draft, risk_code: e.target.value })} /></F>
                <F label="العنوان"><Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></F>
                <F label="الفئة">
                  <Select value={draft.category ?? "المخاطر التشغيلية"} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="المالك"><Input value={draft.owner ?? ""} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></F>
                <div className="col-span-2">
                  <F label="الوصف"><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></F>
                </div>
                <ScoreField label="Likelihood" value={draft.likelihood} onChange={(v) => setDraft({ ...draft, likelihood: v })} />
                <ScoreField label="Impact" value={draft.impact} onChange={(v) => setDraft({ ...draft, impact: v })} />
                <div className="col-span-2">
                  <F label="Mitigation"><Textarea rows={2} value={draft.mitigation ?? ""} onChange={(e) => setDraft({ ...draft, mitigation: e.target.value })} /></F>
                </div>
                <ScoreField label="Residual likelihood" value={draft.residual_likelihood} onChange={(v) => setDraft({ ...draft, residual_likelihood: v })} />
                <ScoreField label="Residual impact" value={draft.residual_impact} onChange={(v) => setDraft({ ...draft, residual_impact: v })} />
                <F label="الحالة">
                  <Select value={draft.status ?? "open"} onValueChange={(v) => setDraft({ ...draft, status: v as RiskStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Review date">
                  <Input type="date" value={draft.review_date ?? ""} onChange={(e) => setDraft({ ...draft, review_date: e.target.value })} />
                </F>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.risk_code || !draft.title}>حفظ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>All risks</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>المالك</TableHead>
                <TableHead className="text-right">Inherent</TableHead>
                <TableHead className="text-right">Residual</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const inh = riskLevel(r.inherent_score);
                const res = riskLevel(r.residual_score);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.risk_code}</TableCell>
                    <TableCell>{r.title}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>{r.owner ?? "—"}</TableCell>
                    <TableCell className={"text-right font-medium " + inh.cls}>{r.inherent_score}</TableCell>
                    <TableCell className={"text-right font-semibold " + res.cls}>{r.residual_score}</TableCell>
                    <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                    <TableCell className="w-24 text-right">
                      {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>}
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No risks recorded.</TableCell></TableRow>}
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
          <Button key={n} size="sm" variant={value === n ? "default" : "outline"} className="w-10" onClick={() => onChange(n)} type="button">
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
