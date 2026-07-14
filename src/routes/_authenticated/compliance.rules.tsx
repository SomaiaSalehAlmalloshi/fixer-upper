import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  FRAMEWORK_LABEL, METRIC_LABEL, OP_LABEL, SEVERITY_COLOR, deleteRule,
  fmtValue, listRules, upsertRule, type Rule,
} from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance/rules")({
  component: Rules,
});

const METRICS = Object.keys(METRIC_LABEL) as (keyof typeof METRIC_LABEL)[];
const OPS = Object.keys(OP_LABEL) as (keyof typeof OP_LABEL)[];

function Rules() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: rules = [] } = useQuery({ queryKey: ["compliance", "rules"], queryFn: listRules });
  const [open, setOpen] = useState(false);
  const emptyForm: Partial<Rule> = { framework: "basel_iii", metric: "custom", operator: "gte", severity: "high", unit: "ratio", active: true, category: "custom" };
  const [form, setForm] = useState<Partial<Rule>>(emptyForm);

  const save = useMutation({
    mutationFn: () => upsertRule({ ...form, created_by: user!.id }),
    onSuccess: () => { toast.success("Rule saved"); setOpen(false); setForm(emptyForm); qc.invalidateQueries({ queryKey: ["compliance", "rules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (r: Rule) => upsertRule({ id: r.id, active: !r.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance", "rules"] }),
  });
  const remove = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["compliance", "rules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Rule catalog</CardTitle>
          <p className="text-sm text-muted-foreground">Basel III preset rules ship enabled. Add Basel IV, local regulator or custom rules here — they run in the same monitoring engine.</p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New rule</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Custom compliance rule</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Code (e.g. B4-XYZ)" value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                  <Select value={form.framework} onValueChange={(v) => setForm({ ...form, framework: v as Rule["framework"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(FRAMEWORK_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input placeholder="الاسم" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Textarea placeholder="الوصف" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="grid grid-cols-3 gap-2">
                  <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v as Rule["metric"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METRICS.map((m) => <SelectItem key={m} value={m}>{METRIC_LABEL[m]}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={form.operator} onValueChange={(v) => setForm({ ...form, operator: v as Rule["operator"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{OPS.map((o) => <SelectItem key={o} value={o}>{OP_LABEL[o]}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as Rule["severity"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["low", "medium", "high", "critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" step="0.0001" placeholder="Warn threshold" value={form.threshold_warn ?? ""} onChange={(e) => setForm({ ...form, threshold_warn: e.target.value === "" ? null : Number(e.target.value) })} />
                  <Input type="number" step="0.0001" placeholder="Fail threshold" value={form.threshold_fail ?? ""} onChange={(e) => setForm({ ...form, threshold_fail: Number(e.target.value) })} />
                  <Input placeholder="Unit (ratio / count)" value={form.unit ?? ""} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                </div>
                <Textarea placeholder="Recommendation" value={form.recommendation ?? ""} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} />
                <Input placeholder="Reference (e.g. BCBS 238)" value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
              <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.code || !form.name || form.threshold_fail == null}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Code</TableHead><TableHead>الاسم</TableHead><TableHead>Framework</TableHead>
            <TableHead>Metric</TableHead><TableHead>Threshold</TableHead><TableHead>مستوى الخطورة</TableHead>
            <TableHead>نشط</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-xs">{FRAMEWORK_LABEL[r.framework]}</TableCell>
                <TableCell className="text-xs">{METRIC_LABEL[r.metric]}</TableCell>
                <TableCell className="text-xs">
                  {OP_LABEL[r.operator]} {fmtValue(Number(r.threshold_fail), r.unit)}
                  {r.threshold_warn != null && <span className="text-muted-foreground"> (warn {fmtValue(Number(r.threshold_warn), r.unit)})</span>}
                </TableCell>
                <TableCell><Badge className={SEVERITY_COLOR[r.severity]}>{r.severity}</Badge></TableCell>
                <TableCell><Switch checked={r.active} disabled={!canWrite} onCheckedChange={() => toggle.mutate(r)} /></TableCell>
                <TableCell className="text-right">{isAdmin && !r.is_preset && <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
