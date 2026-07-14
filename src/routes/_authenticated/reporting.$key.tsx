import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, CalendarPlus, Download, FileSpreadsheet, FileText, FileType, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  AUDIENCE_LABEL, CADENCE_LABEL, FORMAT_LABEL,
  exportReport, getReport, logRun, nextRunFromCadence, upsertSchedule,
  type Cadence, type Format, type ReportPayload,
} from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/reporting/$key")({
  component: ReportView,
});

const CADENCES: Cadence[] = ["once", "daily", "weekly", "monthly", "quarterly"];
const FORMATS: Format[] = ["pdf", "excel", "csv", "word"];

function ReportView() {
  const { key } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { user, canWrite } = useAuth();
  const def = getReport(key);

  const { data: payload, isFetching } = useQuery<ReportPayload>({
    queryKey: ["report", key],
    queryFn: () => def!.build(),
    enabled: !!def,
  });

  const [schedOpen, setSchedOpen] = useState(false);
  const [distOpen, setDistOpen] = useState(false);
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [formats, setFormats] = useState<Format[]>(["pdf"]);
  const [recipientsText, setRecipientsText] = useState("");
  const [notes, setNotes] = useState("");
  const [distFormat, setDistFormat] = useState<Format>("pdf");
  const [distRecipients, setDistRecipients] = useState("");
  const [distNote, setDistNote] = useState("");

  const parseRecipients = (s: string) => s.split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean);

  const exportOne = useMutation({
    mutationFn: async (format: Format) => {
      if (!payload || !def) throw new Error("Report not ready");
      const fileName = exportReport(payload, format);
      await logRun({
        report_key: def.key, report_name: def.name, audience: def.audience,
        format, status: "success", file_name: fileName, distributed: false,
        run_by: user?.id ?? null,
      });
      return fileName;
    },
    onSuccess: (n) => { toast.success(`Exported ${n}`); qc.invalidateQueries({ queryKey: ["report-runs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSchedule = useMutation({
    mutationFn: async () => {
      if (!def) throw new Error("No report");
      const recipients = parseRecipients(recipientsText);
      const next = nextRunFromCadence(cadence);
      return upsertSchedule({
        report_key: def.key, report_name: def.name, audience: def.audience,
        cadence, formats, recipients, notes,
        next_run_at: next?.toISOString() ?? null,
        active: true,
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => { toast.success("Schedule saved"); setSchedOpen(false); nav({ to: "/reporting/schedules" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const distribute = useMutation({
    mutationFn: async () => {
      if (!payload || !def) throw new Error("Report not ready");
      const recipients = parseRecipients(distRecipients);
      if (!recipients.length) throw new Error("Add at least one recipient");
      const fileName = exportReport(payload, distFormat);
      await logRun({
        report_key: def.key, report_name: def.name, audience: def.audience,
        format: distFormat, status: "success", file_name: fileName,
        recipients, distributed: true,
        distribution_note: distNote || `Prepared for ${recipients.length} recipient(s). Attach ${fileName} in your email client.`,
        run_by: user?.id ?? null,
      });
      return fileName;
    },
    onSuccess: (n) => {
      toast.success(`Prepared ${n} for distribution. Attach it in your mail client and send.`);
      setDistOpen(false); setDistRecipients(""); setDistNote("");
      qc.invalidateQueries({ queryKey: ["report-runs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!def) return <div className="text-muted-foreground">Unknown report — <Link to="/reporting" className="text-primary hover:underline">back to catalog</Link>.</div>;

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={() => nav({ to: "/reporting" })}><ArrowLeft className="mr-1 h-4 w-4" /> Back to catalog</Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {def.name}</CardTitle>
              <div className="mt-2 flex gap-2"><Badge variant="outline">{AUDIENCE_LABEL[def.audience]}</Badge><Badge variant="secondary">Live data</Badge></div>
              <p className="mt-2 text-sm text-muted-foreground">{def.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => exportOne.mutate("pdf")} disabled={!payload}><FileType className="mr-1 h-4 w-4" /> PDF</Button>
              <Button size="sm" variant="outline" onClick={() => exportOne.mutate("excel")} disabled={!payload}><FileSpreadsheet className="mr-1 h-4 w-4" /> Excel</Button>
              <Button size="sm" variant="outline" onClick={() => exportOne.mutate("csv")} disabled={!payload}><Download className="mr-1 h-4 w-4" /> CSV</Button>
              <Button size="sm" variant="outline" onClick={() => exportOne.mutate("word")} disabled={!payload}><FileText className="mr-1 h-4 w-4" /> Word</Button>
              {canWrite && (
                <Dialog open={distOpen} onOpenChange={setDistOpen}>
                  <DialogTrigger asChild><Button size="sm" disabled={!payload}><Mail className="mr-1 h-4 w-4" /> Distribute</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Distribute report</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Generates the file locally, records a distribution run with the recipient list, and hands off to your mail client. Configure an email provider later to send automatically.</p>
                      <div>
                        <label className="text-xs font-medium">Format</label>
                        <Select value={distFormat} onValueChange={(v) => setDistFormat(v as Format)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{FORMATS.map((f) => <SelectItem key={f} value={f}>{FORMAT_LABEL[f]}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Recipients (comma or newline separated)</label>
                        <Textarea placeholder="cfo@bank.com, board@bank.com" value={distRecipients} onChange={(e) => setDistRecipients(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium">ملاحظة</label>
                        <Textarea placeholder="Cover note recorded in the audit log" value={distNote} onChange={(e) => setDistNote(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => distribute.mutate()} disabled={distribute.isPending}>Prepare & log</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              {canWrite && (
                <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
                  <DialogTrigger asChild><Button size="sm" variant="secondary"><CalendarPlus className="mr-1 h-4 w-4" /> Schedule</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Schedule {def.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium">Cadence</label>
                        <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{CADENCES.map((c) => <SelectItem key={c} value={c}>{CADENCE_LABEL[c]}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Formats</label>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {FORMATS.map((f) => {
                            const active = formats.includes(f);
                            return (
                              <Button key={f} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => setFormats((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])}>{FORMAT_LABEL[f]}</Button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Recipients</label>
                        <Textarea placeholder="cfo@bank.com, risk-committee@bank.com" value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium">ملاحظات</label>
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => saveSchedule.mutate()} disabled={!formats.length || saveSchedule.isPending}>Save schedule</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {isFetching || !payload ? (
        <div className="text-muted-foreground">Preparing report…</div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Key indicators</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {payload.headline.map((h) => (
                  <div key={h.label} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">{h.label}</div>
                    <div className="mt-1 text-lg font-semibold">{h.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {payload.sections.map((s) => (
            <Card key={s.title}>
              <CardHeader><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>{s.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {s.rows.map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => <TableCell key={j} className="text-xs">{String(cell)}</TableCell>)}
                      </TableRow>
                    ))}
                    {!s.rows.length && <TableRow><TableCell colSpan={s.columns.length} className="py-4 text-center text-muted-foreground">No data.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
