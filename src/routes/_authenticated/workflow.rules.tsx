import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  ACTION_LABEL, CHANNEL_LABEL, MODULE_LABEL, TRIGGER_LABEL,
  deleteRule, listRules, upsertRule,
  type Action, type Channel, type Module, type Trigger,
} from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/workflow/rules")({
  component: RulesPage,
});

const MODULES: Module[] = ["compliance", "credit", "market", "operational", "liquidity", "stress", "rwa", "reporting", "system"];
const TRIGGERS: Trigger[] = ["reminder_before_due", "escalate_overdue", "on_status_change", "on_severity"];
const ACTIONS: Action[] = ["notify_assignee", "notify_role", "reassign", "change_priority", "change_status"];
const CHANNELS: Channel[] = ["in_app", "email", "sms", "push"];

function RulesPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery({ queryKey: ["wf", "rules"], queryFn: listRules });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", source_module: "compliance" as Module,
    trigger: "reminder_before_due" as Trigger, action: "notify_assignee" as Action,
    channel: "in_app" as Channel, offset_days: 3, target_role: "", active: true,
  });

  const save = useMutation({
    mutationFn: () => upsertRule({
      name: form.name, description: form.description || null,
      source_module: form.source_module, trigger: form.trigger, action: form.action,
      channel: form.channel, offset_days: form.offset_days,
      target_role: form.target_role || null, active: form.active,
      created_by: user?.id ?? null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wf", "rules"] }); toast.success("Rule saved"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wf", "rules"] }); toast.success("Rule removed"); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      upsertRule({ id, active, name: rules.find((r) => r.id === id)!.name, source_module: rules.find((r) => r.id === id)!.source_module, trigger: rules.find((r) => r.id === id)!.trigger, action: rules.find((r) => r.id === id)!.action, channel: rules.find((r) => r.id === id)!.channel }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wf", "rules"] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Reminder & Escalation Rules</CardTitle>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New rule</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New workflow rule</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الوحدة</Label><Select value={form.source_module} onValueChange={(v) => setForm({ ...form, source_module: v as Module })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MODULES.map((m) => <SelectItem key={m} value={m}>{MODULE_LABEL[m]}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Trigger</Label><Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v as Trigger })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TRIGGERS.map((t) => <SelectItem key={t} value={t}>{TRIGGER_LABEL[t]}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Action</Label><Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v as Action })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{ACTION_LABEL[a]}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Channel</Label><Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as Channel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABEL[c]}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Offset (days)</Label><Input type="number" value={form.offset_days} onChange={(e) => setForm({ ...form, offset_days: Number(e.target.value) })} /></div>
                  <div><Label>Target role (optional)</Label><Input value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })} placeholder="admin / approver / analyst" /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>نشط</Label></div>
                <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Save rule</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>الاسم</TableHead><TableHead>الوحدة</TableHead><TableHead>Trigger</TableHead>
            <TableHead>Action</TableHead><TableHead>Channel</TableHead><TableHead>Offset</TableHead>
            <TableHead>Role</TableHead><TableHead>نشط</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r.name}</div>{r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}</TableCell>
                <TableCell><Badge variant="outline">{MODULE_LABEL[r.source_module]}</Badge></TableCell>
                <TableCell>{TRIGGER_LABEL[r.trigger]}</TableCell>
                <TableCell>{ACTION_LABEL[r.action]}</TableCell>
                <TableCell>{CHANNEL_LABEL[r.channel]}</TableCell>
                <TableCell>{r.offset_days}d</TableCell>
                <TableCell>{r.target_role ?? "—"}</TableCell>
                <TableCell><Switch checked={r.active} disabled={!isAdmin} onCheckedChange={(v) => toggle.mutate({ id: r.id, active: v })} /></TableCell>
                <TableCell>{isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
            {rules.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No rules configured.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
