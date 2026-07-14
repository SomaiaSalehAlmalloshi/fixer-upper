import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDictionary, DICTIONARY_VERSION, type DictionaryPackage, type DictionarySheet } from "@/lib/dictionary";
import {
  buildRichTemplate,
  buildDictionaryReference,
} from "@/lib/dictionary/template-generator";
import { Download, FileSpreadsheet, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dictionary/")({
  component: DictionaryIndex,
  loader: () => ({ packages: getDictionary() }),
});

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function DictionaryIndex() {
  const { packages } = Route.useLoaderData();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            Dictionary Version
          </div>
          <div className="text-lg font-semibold">v{DICTIONARY_VERSION}</div>
        </div>
        <Button
          variant="outline"
          onClick={async () =>
            download(
              await buildDictionaryReference(packages),
              `data-dictionary-v${DICTIONARY_VERSION}.xlsx`,
            )
          }
        >
          <BookOpen className="ms-2 h-4 w-4" />
          تنزيل القاموس الكامل (Excel)
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg: DictionaryPackage) => {
          const totalColumns = pkg.sheets.reduce(
            (s: number, x: DictionarySheet) => s + x.columns.length,
            0,
          );
          const persisted = pkg.sheets.filter((s: DictionarySheet) => s.persisted).length;
          return (
            <Card key={pkg.key}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{pkg.label}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pkg.description}
                  </p>
                </div>
                <Badge
                  variant={
                    pkg.version.status === "active"
                      ? "default"
                      : pkg.version.status === "deprecated"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  v{pkg.version.version} · {pkg.version.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Stat label="Worksheets" value={pkg.sheets.length} />
                  <Stat label="Columns" value={totalColumns} />
                  <Stat label="Persisted" value={persisted} />
                </div>
                <div className="text-xs text-muted-foreground">
                  <div>Created: {pkg.version.createdAt}</div>
                  <div>Modified: {pkg.version.modifiedAt}</div>
                  <div>Compatibility: {pkg.version.compatibility}</div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" asChild>
                    <Link
                      to="/dictionary/$package"
                      params={{ package: pkg.key }}
                    >
                      <FileSpreadsheet className="ms-2 h-4 w-4" />
                      تفاصيل الحزمة
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () =>
                      download(
                        await buildRichTemplate(pkg),
                        `template_${pkg.key}_v${pkg.version.version}.xlsx`,
                      )
                    }
                  >
                    <Download className="ms-2 h-4 w-4" />
                    تنزيل النموذج
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
