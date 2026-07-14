import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PACKAGES } from "@/lib/imports/registry";
import { buildTemplate } from "@/lib/imports/engine";
import { supabase } from "@/integrations/supabase/client";
import { Download, ArrowLeft, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/imports/")({
  component: ImportsDashboard,
});

function downloadTemplate(pkgKey: string) {
  const pkg = PACKAGES.find((p) => p.key === pkgKey);
  if (!pkg) return;
  const blob = buildTemplate(pkg);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `template_${pkg.key}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportsDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["import-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("import_history")
        .select("package_key, rows_imported, rows_failed, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">إجمالي عمليات الاستيراد</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.length ?? 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">صفوف تم استيرادها</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600">{stats?.reduce((s, r) => s + (r.rows_imported ?? 0), 0) ?? 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">صفوف فشلت</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{stats?.reduce((s, r) => s + (r.rows_failed ?? 0), 0) ?? 0}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PACKAGES.map((pkg) => {
          const persisted = pkg.sheets.filter((s) => s.table).length;
          return (
            <Card key={pkg.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      {pkg.label}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
                  </div>
                  <Badge variant="outline">{persisted}/{pkg.sheets.length} sheets</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3">
                <ul className="space-y-1 text-sm">
                  {pkg.sheets.slice(0, 6).map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-2">
                      <span className="truncate">{s.key}</span>
                      {s.table ? (
                        <Badge variant="secondary" className="text-[10px]">{s.table}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">validation only</Badge>
                      )}
                    </li>
                  ))}
                  {pkg.sheets.length > 6 && <li className="text-xs text-muted-foreground">+{pkg.sheets.length - 6} أخرى…</li>}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/imports/$package" params={{ package: pkg.key }}>
                      <ArrowLeft className="ms-2 h-4 w-4" /> فتح
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadTemplate(pkg.key)}>
                    <Download className="ms-2 h-4 w-4" /> تحميل النموذج
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
