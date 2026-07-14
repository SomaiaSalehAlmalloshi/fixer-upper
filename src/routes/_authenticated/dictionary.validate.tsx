import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDictionary, type DictionaryPackage } from "@/lib/dictionary";
import {
  validateWorkbookAgainstDictionary,
  type DictionaryValidationReport,
} from "@/lib/dictionary/validator";
import { toast } from "sonner";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dictionary/validate")({
  component: ValidatePage,
  loader: () => ({ packages: getDictionary() }),
});

function ValidatePage() {
  const { packages } = Route.useLoaderData();
  const [pkgKey, setPkgKey] = useState<string>(packages[0]?.key ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<DictionaryValidationReport | null>(null);
  const [busy, setBusy] = useState(false);

  const pkg = packages.find((p: DictionaryPackage) => p.key === pkgKey);

  async function handleFile(f: File) {
    if (!pkg) return;
    setFile(f);
    setReport(null);
    setBusy(true);
    try {
      const r = await validateWorkbookAgainstDictionary(f, pkg);
      setReport(r);
      if (r.ok) toast.success("الملف مطابق لقاموس البيانات");
      else toast.warning(`تم اكتشاف ${r.issues.filter((i) => i.level === "error").length} خطأ`);
    } catch (e) {
      toast.error(`فشل التحقق: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>تحقق فقط — بدون استيراد</AlertTitle>
        <AlertDescription>
          يستخدم هذا الوضع منطق التحقق نفسه المستخدم في مركز الاستيراد
          (بدون تكرار)، ثم يضيف فحوصات هيكلية إضافية: أوراق مفقودة،
          أعمدة مفقودة، مفاتيح أساسية مكررة، وقيم غير صالحة.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. اختر الحزمة ورفع الملف</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-sm">
            <Select value={pkgKey} onValueChange={setPkgKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {packages.map((p: DictionaryPackage) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label} — v{p.version.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center hover:bg-accent/40">
            {busy ? (
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
            )}
            <span className="text-sm">
              {file ? file.name : "اختر ملف .xlsx للتحقق"}
            </span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && handleFile(e.target.files[0])
              }
            />
          </label>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              {report.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              تقرير التحقق
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline">{report.totalRows} صف</Badge>
              <Badge variant={report.ok ? "default" : "destructive"}>
                {report.issues.filter((i) => i.level === "error").length} خطأ
              </Badge>
              <Badge variant="secondary">
                {report.issues.filter((i) => i.level === "warning").length} تحذير
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Per-sheet summary</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sheet</TableHead>
                    <TableHead>Persisted</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Duplicate keys</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.perSheet.map((s) => (
                    <TableRow key={s.sheet}>
                      <TableCell className="font-medium">{s.sheet}</TableCell>
                      <TableCell>
                        {s.persisted ? (
                          <Badge variant="secondary">yes</Badge>
                        ) : (
                          <Badge variant="outline">no</Badge>
                        )}
                      </TableCell>
                      <TableCell>{s.rowCount}</TableCell>
                      <TableCell
                        className={s.errorCount ? "text-red-600" : ""}
                      >
                        {s.errorCount}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.duplicateKeys.length
                          ? s.duplicateKeys.slice(0, 5).join(", ") +
                            (s.duplicateKeys.length > 5 ? "…" : "")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {report.issues.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Issues ({report.issues.length})
                </h3>
                <div className="max-h-96 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Level</TableHead>
                        <TableHead>Sheet</TableHead>
                        <TableHead>Row</TableHead>
                        <TableHead>Column</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.issues.slice(0, 200).map((i, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge
                              variant={
                                i.level === "error"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {i.level}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {i.sheet ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {i.row ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {i.column ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {i.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {report.issues.length > 200 && (
                    <div className="p-2 text-xs text-muted-foreground">
                      …و {report.issues.length - 200} إضافية
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
