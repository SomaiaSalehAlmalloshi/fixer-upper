import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, fmtPct, type Calc } from "@/lib/rwa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { data = [] } = useQuery({
    queryKey: ["calc-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rwa_calculations").select("*").order("calculated_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Calc[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">سجل الحسابات</h1>
        <p className="text-muted-foreground">يتم حفظ نسخة من كل حساب لأغراض التدقيق. يُعرض آخر 200.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>اللقطات</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الوقت</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>الأصل</TableHead>
                <TableHead className="text-right">التعرّض</TableHead>
                <TableHead className="text-right">وزن المخاطر</TableHead>
                <TableHead className="text-right">الأصول المرجّحة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => {
                const snap = c.snapshot as { name?: string; reference_code?: string } | null;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.calculated_at), { addSuffix: true })}</TableCell>
                    <TableCell className="capitalize">{c.category}</TableCell>
                    <TableCell>{snap?.name ?? snap?.reference_code ?? c.asset_id}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(c.exposure_amount))}</TableCell>
                    <TableCell className="text-right">{fmtPct(Number(c.risk_weight))}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(Number(c.rwa_amount))}</TableCell>
                  </TableRow>
                );
              })}
              {data.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">لا يوجد سجل بعد.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
