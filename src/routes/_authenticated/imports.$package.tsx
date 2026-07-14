import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { findPackage } from "@/lib/imports/registry";
import { parseWorkbook, runImport, buildTemplate, buildErrorReport, type ParsedWorkbook, type ImportOutcome } from "@/lib/imports/engine";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2, FileDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/imports/$package")({
  component: PackageImport,
  loader: ({ params }) => {
    const pkg = findPackage(params.package);
    if (!pkg) throw notFound();
    return { pkg };
  },
});

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function PackageImport() {
  const { pkg } = Route.useLoaderData();
  const { user, canWrite } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  const totalErrors = parsed?.sheets.reduce((s, x) => s + x.errors.length, 0) ?? 0;
  const totalRows = parsed?.sheets.reduce((s, x) => s + x.preparedRows.length, 0) ?? 0;
  const canImport = !!parsed && totalErrors === 0 && totalRows > 0 && canWrite && !busy;

  async function handleFile(f: File) {
    setFile(f); setOutcome(null); setBusy(true);
    try {
      const p = await parseWorkbook(f, pkg);
      setParsed(p);
      const errs = p.sheets.reduce((s, x) => s + x.errors.length, 0);
      if (errs) toast.warning(`${errs} خطأ تحقّق — راجع اللوحة أدناه`);
      else toast.success("تمت المعالجة — جاهز للاستيراد");
    } catch (e) {
      toast.error(`فشل قراءة الملف: ${(e as Error).message}`);
      setParsed(null);
    } finally { setBusy(false); }
  }

  async function handleImport() {
    if (!parsed || !user) return;
    setBusy(true);
    try {
      const res = await runImport(pkg, parsed, user.id);
      setOutcome(res);
      if (res.totalFailed === 0) toast.success(`تم استيراد ${res.totalImported} صف`);
      else toast.warning(`استيراد جزئي: ${res.totalImported} نجح / ${res.totalFailed} فشل`);
    } catch (e) {
      toast.error(`فشل الاستيراد: ${(e as Error).message}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{pkg.label}</h2>
          <p className="text-sm text-muted-foreground">{pkg.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => download(buildTemplate(pkg), `template_${pkg.key}.xlsx`)}>
            <Download className="ms-2 h-4 w-4" /> تحميل النموذج
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/imports">رجوع</Link>
          </Button>
        </div>
      </div>

      {!canWrite && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>صلاحية غير كافية</AlertTitle>
          <AlertDescription>يجب أن يكون لديك دور محلل أو مسؤول لاستيراد البيانات.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">1. رفع ملف Excel (.xlsx)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center hover:bg-accent/40">
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
            <span className="text-sm">{file ? file.name : "اختر ملف .xlsx للرفع"}</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">2. لوحة التحقق</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={totalErrors ? "destructive" : "default"}>{totalErrors} أخطاء</Badge>
              <Badge variant="outline">{totalRows} صف</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.sheets.map((s) => (
              <div key={s.sheetName} className="rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <strong>{s.sheetName}</strong>
                    {s.spec?.table ? <Badge variant="secondary" className="text-[10px]">{s.spec.table}</Badge>
                      : <Badge variant="outline" className="text-[10px]">لا يتم التخزين</Badge>}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span>الصفوف: {s.preparedRows.length}</span>
                    <span className={s.errors.length ? "text-red-600" : "text-emerald-600"}>الأخطاء: {s.errors.length}</span>
                  </div>
                </div>
                {s.errors.length > 0 && (
                  <div className="max-h-40 overflow-auto border-b bg-red-50 p-2 text-xs dark:bg-red-950/20">
                    {s.errors.slice(0, 20).map((e, i) => (
                      <div key={i} className="py-0.5">
                        الصف {e.row}{e.column ? ` · ${e.column}` : ""} — {e.message}
                      </div>
                    ))}
                    {s.errors.length > 20 && <div className="pt-1 text-muted-foreground">…و {s.errors.length - 20} إضافية</div>}
                  </div>
                )}
                {s.rows.length > 0 && s.spec && (
                  <div className="max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>{Object.keys(s.rows[0]).slice(0, 8).map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                      </TableHeader>
                      <TableBody>
                        {s.rows.slice(0, 5).map((r, i) => (
                          <TableRow key={i}>
                            {Object.keys(s.rows[0]).slice(0, 8).map((h) => (
                              <TableCell key={h} className="text-xs">{String(r[h] ?? "—")}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {s.rows.length > 5 && <div className="p-2 text-xs text-muted-foreground">…معاينة أول 5 صفوف من {s.rows.length}</div>}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {parsed && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. تنفيذ الاستيراد</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button disabled={!canImport} onClick={handleImport}>
              {busy ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Upload className="ms-2 h-4 w-4" />}
              استيراد {totalRows} صف
            </Button>
            {totalErrors > 0 && (
              <span className="text-sm text-red-600">يجب إصلاح الأخطاء قبل الاستيراد.</span>
            )}
          </CardContent>
        </Card>
      )}

      {outcome && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> ملخّص الاستيراد
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => download(buildErrorReport(outcome), `errors_${pkg.key}.xlsx`)}>
              <FileDown className="ms-2 h-4 w-4" /> تنزيل تقرير الأخطاء
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-3 grid gap-2 sm:grid-cols-4">
              <Stat label="نجح" value={outcome.totalImported} tone="ok" />
              <Stat label="فشل" value={outcome.totalFailed} tone={outcome.totalFailed ? "bad" : "muted"} />
              <Stat label="الصفحات" value={outcome.sheets.length} />
              <Stat label="المدة (مل ث)" value={outcome.durationMs} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصفحة</TableHead><TableHead>الجدول</TableHead>
                  <TableHead>نجح</TableHead><TableHead>فشل</TableHead><TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outcome.sheets.map((s) => (
                  <TableRow key={s.sheetName}>
                    <TableCell className="font-medium">{s.sheetName}</TableCell>
                    <TableCell className="text-xs">{s.table ?? "—"}</TableCell>
                    <TableCell>{s.rowsImported}</TableCell>
                    <TableCell className={s.rowsFailed ? "text-red-600" : ""}>{s.rowsFailed}</TableCell>
                    <TableCell>
                      {s.skipped ? <Badge variant="outline">تم التخطي</Badge>
                        : s.rowsFailed ? <Badge variant="destructive">جزئي</Badge>
                        : <Badge>ناجح</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" | "muted" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}
