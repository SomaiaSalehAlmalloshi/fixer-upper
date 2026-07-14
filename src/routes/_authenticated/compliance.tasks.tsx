import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  FRAMEWORK_LABEL, SEVERITY_COLOR, TASK_STATUS_COLOR, TASK_STATUS_LABEL,
  deleteTask, listTasks, upsertTask, type Task,
} from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance/tasks")({
  component: Tasks,
});

function Tasks() {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: tasks = [] } = useQuery({ queryKey: ["compliance", "tasks"], queryFn: listTasks });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Task>>({ framework: "basel_iii", severity: "medium", priority: 3, status: "open" });

  const save = useMutation({
    mutationFn: () => upsertTask({ ...form, created_by: user!.id }),
    onSuccess: () => { toast.success("Task saved"); setOpen(false); setForm({ framework: "basel_iii", severity: "medium", priority: 3, status: "open" }); qc.invalidateQueries({ queryKey: ["compliance", "tasks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["compliance", "tasks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Remediation tasks</CardTitle>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New compliance task</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <Input placeholder="العنوان" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Textarea placeholder="الوصف" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <Textarea placeholder="Recommendation" value={form.recommendation ?? ""} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={form.framework} onValueChange={(v) => setForm({ ...form, framework: v as Task["framework"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FRAMEWORK_LABEL) as (keyof typeof FRAMEWORK_LABEL)[]).map((k) => (
                        <SelectItem key={k} value={k}>{FRAMEWORK_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as Task["severity"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["low", "medium", "high", "critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} max={5} placeholder="Priority (1-5)" value={form.priority ?? 3} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
                  <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>حفظ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>العنوان</TableHead><TableHead>Framework</TableHead><TableHead>مستوى الخطورة</TableHead>
            <TableHead>الأولوية</TableHead><TableHead>Due</TableHead><TableHead>الحالة</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link to="/compliance/tasks/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.title}</Link>
                  {t.description && <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>}
                </TableCell>
                <TableCell className="text-xs">{FRAMEWORK_LABEL[t.framework]}</TableCell>
                <TableCell><Badge className={SEVERITY_COLOR[t.severity]}>{t.severity}</Badge></TableCell>
                <TableCell>P{t.priority}</TableCell>
                <TableCell className="text-xs">{t.due_date ?? "—"}</TableCell>
                <TableCell><Badge className={TASK_STATUS_COLOR[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge></TableCell>
                <TableCell className="text-right">
                  {isAdmin && <Button size="sm" variant="ghost" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
            {!tasks.length && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No tasks yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
