import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDictionaryPackage, type DictionarySheet, type DictionaryColumn } from "@/lib/dictionary";
import { buildRichTemplate } from "@/lib/dictionary/template-generator";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dictionary/$package")({
  component: PackageDetail,
  loader: ({ params }) => {
    const pkg = getDictionaryPackage(params.package);
    if (!pkg) throw notFound();
    return { pkg };
  },
});

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function PackageDetail() {
  const { pkg } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            <Link to="/dictionary" className="hover:underline">
              قاموس البيانات
            </Link>{" "}
            / <span>{pkg.key}</span>
          </div>
          <h2 className="text-xl font-semibold">{pkg.label}</h2>
          <p className="text-sm text-muted-foreground">{pkg.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">v{pkg.version.version}</Badge>
          <Badge
            variant={
              pkg.version.status === "active" ? "default" : "secondary"
            }
          >
            {pkg.version.status}
          </Badge>
          <Button
            size="sm"
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
      </div>

      {pkg.sheets.map((sheet: DictionarySheet) => (
        <Card key={sheet.key}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{sheet.label}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{sheet.key}</span>
                {sheet.table ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {sheet.table}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    validated only
                  </Badge>
                )}
                {sheet.naturalKey && (
                  <span>
                    PK: <code>{sheet.naturalKey}</code>
                  </span>
                )}
              </div>
              {sheet.note && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {sheet.note}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {sheet.columns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                لا توجد أعمدة معرَّفة بعد لهذه الورقة.
              </p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Column</TableHead>
                      <TableHead>Display</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Req</TableHead>
                      <TableHead>DB Field</TableHead>
                      <TableHead>Rules</TableHead>
                      <TableHead>Example</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheet.columns.map((c: DictionaryColumn) => (
                      <TableRow key={c.key}>
                        <TableCell className="font-mono text-xs">
                          {c.key}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.displayName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {c.dataType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.required ? (
                            <Badge className="text-[10px]">Yes</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">
                          {c.databaseField}
                        </TableCell>
                        <TableCell className="max-w-xs text-[11px] text-muted-foreground">
                          {c.validationRules.join(" · ")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {String(c.exampleValue ?? "—")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
