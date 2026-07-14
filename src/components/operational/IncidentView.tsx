import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { AlertTriangle, Plus, Pencil, Trash2, DollarSign, ShieldCheck, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  CATEGORY_LABEL, SEVERITY_COLOR, SEVERITY_LABEL, STATUS_LABEL,
  deleteIncident, fmtMoney, listIncidents, upsertIncident,
  type Incident, type OpCategory, type OpSeverity, type OpStatus,
} from "@/lib/operational";
import { formatDistanceToNow } from "date-fns";

const SEV: OpSeverity[] = ["low", "medium", "high", "critical"];
const STATUSES: OpStatus[] = ["open", "investigating", "contained", "resolved", "closed"];

type Props = {
  category: OpCategory;
  title: string;
  description: string;
  eventTypes?: string[];
};

export function IncidentView({ category, title, description, eventTypes }: Props) {
  const qc = useQueryClient();
  const { user, canWrite, isAdmin } = useAuth();
  const { data: incidents = [] } = useQuery({
    queryKey: ["op", "incidents", category],
    queryFn: () => listIncidents(category),
  });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Incident>>({});

  const openNew = () => {
    setDraft({
      category,
      severity: "medium",
      status: "open",
      currency: "USD",
      gross_loss: 0,
      recovery: 0,
      ref_code: `${category.toUpperCase()}-${Date.now().toString().slice(-6)}`,
    });
    setOpen(true);
  };
  const openEdit = (i: Incident) => { setDraft(i); setOpen(true); };

  const save = useMutation({
    mutationFn: (d: Partial<Incident>) => upsertIncident({ ...d, reported_by: user!.id }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["op"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteIncident,
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["op"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const gross = incidents.reduce((s, i) => s + Number(i.gross_loss), 0);
    const net = incidents.reduce((s, i) => s + Number(i.net_loss), 0);
    const openCount = incidents.filter((i) => !["resolved", "closed"].includes(i.status)).length;
    const critical = incidents.filter((i) => i.severity === "critical").length;
    return { gross, net, openCount, critical };
  }, [incidents]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Report {CATEGORY_LABEL[category]}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>{draft.id ? "تعديل" : "New"} {CATEGORY_LABEL[category]}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <F label="المرجع"><Input value={draft.ref_code ?? ""} onChange={(e) => setDraft({ ...draft, ref_code: e.target.value })} /></F>
                <F label="العنوان"><Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></F>
                <F label="مستوى الخطورة">
                  <Select value={draft.severity ?? "medium"} onValueChange={(v) => setDraft({ ...draft, severity: v as OpSeverity })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEV.map((s) => <SelectItem key={s} value={s}>{SEVERITY_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="الحالة">
                  <Select value={draft.status ?? "open"} onValueChange={(v) => setDraft({ ...draft, status: v as OpStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Business line"><Input value={draft.business_line ?? ""} onChange={(e) => setDraft({ ...draft, business_line: e.target.value })} /></F>
                <F label="Event type">
                  {eventTypes ? (
                    <Select value={draft.event_type ?? ""} onValueChange={(v) => setDraft({ ...draft, event_type: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{eventTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input value={draft.event_type ?? ""} onChange={(e) => setDraft({ ...draft, event_type: e.target.value })} />
                  )}
                </F>
                <F label="Gross loss">
                  <Input type="number" step="0.01" value={draft.gross_loss ?? 0} onChange={(e) => setDraft({ ...draft, gross_loss: Number(e.target.value) })} />
                </F>
                <F label="Recovery">
                  <Input type="number" step="0.01" value={draft.recovery ?? 0} onChange={(e) => setDraft({ ...draft, recovery: Number(e.target.value) })} />
                </F>
                <F label="Currency"><Input value={draft.currency ?? "USD"} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></F>
                <F label="Owner email"><Input value={draft.owner_email ?? ""} onChange={(e) => setDraft({ ...draft, owner_email: e.target.value })} /></F>
                <F label="Occurred at">
                  <Input type="datetime-local" value={toLocal(draft.occurred_at)} onChange={(e) => setDraft({ ...draft, occurred_at: new Date(e.target.value).toISOString() })} />
                </F>
                <F label="Discovered at">
                  <Input type="datetime-local" value={toLocal(draft.discovered_at)} onChange={(e) => setDraft({ ...draft, discovered_at: new Date(e.target.value).toISOString() })} />
                </F>
                <div className="col-span-2">
                  <F label="Root cause"><Textarea rows={2} value={draft.root_cause ?? ""} onChange={(e) => setDraft({ ...draft, root_cause: e.target.value })} /></F>
                </div>
                <div className="col-span-2">
                  <F label="الوصف"><Textarea rows={3} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></F>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.ref_code || !draft.title}>حفظ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={AlertTriangle} label="فتح" value={kpis.openCount} accent={kpis.openCount > 0} />
        <Stat icon={ShieldCheck} label="Critical" value={kpis.critical} accent={kpis.critical > 0} />
        <Stat icon={DollarSign} label="Gross loss" value={fmtMoney(kpis.gross)} />
        <Stat icon={Activity} label="Net loss" value={fmtMoney(kpis.net)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Records</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>مستوى الخطورة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>Business line</TableHead>
                <TableHead>Occurred</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.ref_code}</TableCell>
                  <TableCell className="max-w-xs truncate">{i.title}</TableCell>
                  <TableCell><Badge className={SEVERITY_COLOR[i.severity]}>{SEVERITY_LABEL[i.severity]}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{STATUS_LABEL[i.status]}</Badge></TableCell>
                  <TableCell>{i.business_line ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(i.occurred_at), { addSuffix: true })}</TableCell>
                  <TableCell className="text-right">{fmtMoney(i.gross_loss, i.currency)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(i.net_loss, i.currency)}</TableCell>
                  <TableCell className="w-24 text-right">
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove.mutate(i.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!incidents.length && <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No records yet.</TableCell></TableRow>}
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

function Stat({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
        <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function toLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
