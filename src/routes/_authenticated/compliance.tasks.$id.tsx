import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Check, Plus, Send, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  FRAMEWORK_LABEL, SEVERITY_COLOR, TASK_STATUS_COLOR, TASK_STATUS_LABEL,
  addEvidence, approveTask, deleteEvidence, getTask, listAudit, listEvidence,
  rejectTask, setTaskStatus, submitForApproval, upsertTask, type Task,
} from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance/tasks/$id")({
  component: TaskDetail,
});

function TaskDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { user, canWrite, canApprove } = useAuth();

  const { data: task } = useQuery({ queryKey: ["compliance", "task", id], queryFn: () => getTask(id) });
  const { data: evidence = [] } = useQuery({ queryKey: ["compliance", "evidence", id], queryFn: () => listEvidence(id) });
  const { data: audit = [] } = useQuery({ queryKey: ["compliance", "audit", id], queryFn: () => listAudit(id) });

  const [evForm, setEvForm] = useState({ title: "", description: "", url: "" });
  const [resolution, setResolution] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["compliance", "task", id] });
    qc.invalidateQueries({ queryKey: ["compliance", "audit", id] });
    qc.invalidateQueries({ queryKey: ["compliance", "tasks"] });
  };

  const saveTask = useMutation({
    mutationFn: (patch: Partial<Task>) => upsertTask({ id, ...patch }),
    onSuccess: () => { toast.success("تم التحديث"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const start = useMutation({
    mutationFn: () => setTaskStatus(id, "in_progress", user!.id),
    onSuccess: () => { toast.success("Started"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const submit = useMutation({
    mutationFn: () => submitForApproval(id, user!.id),
    onSuccess: () => { toast.success("Submitted for approval"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: () => approveTask(id, user!.id, resolution || undefined),
    onSuccess: () => { toast.success("معتمد"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: () => rejectTask(id, user!.id, rejectReason || "No reason provided"),
    onSuccess: () => { toast.success("مرفوض"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const close = useMutation({
    mutationFn: () => setTaskStatus(id, "closed", user!.id),
    onSuccess: () => { toast.success("Closed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addEv = useMutation({
    mutationFn: () => addEvidence({ ...evForm, task_id: id, uploaded_by: user!.id }),
    onSuccess: () => { toast.success("Evidence added"); setEvForm({ title: "", description: "", url: "" }); qc.invalidateQueries({ queryKey: ["compliance", "evidence", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rmEv = useMutation({
    mutationFn: deleteEvidence,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compliance", "evidence", id] }); },
  });

  if (!task) return <div className="text-muted-foreground">جاري التحميل…</div>;

  const canSubmit = canWrite && (task.status === "open" || task.status === "in_progress");
  const canDecide = canApprove && task.status === "pending_approval";

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={() => nav({ to: "/compliance/tasks" })}><ArrowLeft className="mr-1 h-4 w-4" /> رجوع</Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{task.title}</CardTitle>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge className={TASK_STATUS_COLOR[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
                <Badge className={SEVERITY_COLOR[task.severity]}>{task.severity}</Badge>
                <Badge variant="outline">{FRAMEWORK_LABEL[task.framework]}</Badge>
                <Badge variant="outline">P{task.priority}</Badge>
                {task.due_date && <Badge variant="outline">Due {task.due_date}</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {canWrite && task.status === "open" && <Button size="sm" variant="outline" onClick={() => start.mutate()}>Start</Button>}
              {canSubmit && <Button size="sm" onClick={() => submit.mutate()}><Send className="mr-1 h-3.5 w-3.5" /> Submit for approval</Button>}
              {canApprove && task.status === "approved" && <Button size="sm" variant="outline" onClick={() => close.mutate()}>إغلاق</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {task.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{task.description}</p>}
          {task.recommendation && (
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Recommendation</div>
              <p className="mt-1 text-sm">{task.recommendation}</p>
            </div>
          )}
          {task.resolution && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="text-xs font-medium uppercase text-emerald-500">Resolution</div>
              <p className="mt-1 text-sm">{task.resolution}</p>
            </div>
          )}
          {task.rejection_reason && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="text-xs font-medium uppercase text-destructive">Rejection reason</div>
              <p className="mt-1 text-sm">{task.rejection_reason}</p>
            </div>
          )}

          {canWrite && task.status !== "approved" && task.status !== "closed" && (
            <div className="grid gap-2 md:grid-cols-3">
              <Textarea placeholder="Update description" defaultValue={task.description ?? ""} onBlur={(e) => e.target.value !== (task.description ?? "") && saveTask.mutate({ description: e.target.value })} />
              <Textarea placeholder="Update recommendation" defaultValue={task.recommendation ?? ""} onBlur={(e) => e.target.value !== (task.recommendation ?? "") && saveTask.mutate({ recommendation: e.target.value })} />
              <div className="space-y-2">
                <Select value={task.severity} onValueChange={(v) => saveTask.mutate({ severity: v as Task["severity"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high", "critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" defaultValue={task.due_date ?? ""} onBlur={(e) => saveTask.mutate({ due_date: e.target.value || null })} />
              </div>
            </div>
          )}

          {canDecide && (
            <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">اعتماد</div>
                <Textarea placeholder="Resolution notes" value={resolution} onChange={(e) => setResolution(e.target.value)} />
                <Button size="sm" onClick={() => approve.mutate()}><Check className="mr-1 h-3.5 w-3.5" /> اعتماد</Button>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">رفض</div>
                <Textarea placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <Button size="sm" variant="destructive" onClick={() => reject.mutate()}><X className="mr-1 h-3.5 w-3.5" /> رفض</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Evidence</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {canWrite && (
            <div className="grid gap-2 md:grid-cols-4">
              <Input placeholder="العنوان" value={evForm.title} onChange={(e) => setEvForm({ ...evForm, title: e.target.value })} />
              <Input placeholder="URL or reference" value={evForm.url} onChange={(e) => setEvForm({ ...evForm, url: e.target.value })} />
              <Input placeholder="الوصف" className="md:col-span-1" value={evForm.description} onChange={(e) => setEvForm({ ...evForm, description: e.target.value })} />
              <Button onClick={() => addEv.mutate()} disabled={!evForm.title || addEv.isPending}><Plus className="mr-1 h-4 w-4" /> Attach</Button>
            </div>
          )}
          <Table>
            <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>الوصف</TableHead><TableHead>Link</TableHead><TableHead>Added</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {evidence.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.description}</TableCell>
                  <TableCell className="text-xs">{e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{e.url}</a> : "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{canWrite && <Button size="sm" variant="ghost" onClick={() => rmEv.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              ))}
              {!evidence.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No evidence attached.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Audit trail</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex justify-between border-b pb-2 last:border-0">
                <span className="font-medium">{a.action}</span>
                <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
            {!audit.length && <li className="text-muted-foreground">No audit entries yet.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
