import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/imports/history")({
  component: History,
});

function History() {
  const { data: rows = [] } = useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>سجل عمليات الاستيراد</CardTitle>
        <p className="text-sm text-muted-foreground">آخر 200 عملية استيراد — جميعها موثّقة للتدقيق.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الوقت</TableHead><TableHead>الحزمة</TableHead><TableHead>الملف</TableHead>
            <TableHead>نجح</TableHead><TableHead>فشل</TableHead><TableHead>الحالة</TableHead>
            <TableHead>المدة</TableHead><TableHead>المستخدم</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.package_label}</TableCell>
                <TableCell className="text-xs">{r.file_name}</TableCell>
                <TableCell className="text-emerald-600">{r.rows_imported}</TableCell>
                <TableCell className={r.rows_failed ? "text-red-600" : ""}>{r.rows_failed}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "success" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{r.duration_ms} ms</TableCell>
                <TableCell className="text-xs font-mono">{r.created_by.slice(0, 8)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">لا توجد عمليات استيراد بعد.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
