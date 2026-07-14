import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { computeLiquidityGap, fmtMoney, listCashFlows } from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/buckets")({
  component: BucketsPage,
});

function BucketsPage() {
  const { data: flows = [] } = useQuery({ queryKey: ["liq", "cashflows"], queryFn: listCashFlows });
  const gap = computeLiquidityGap(flows);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>شرائح الاستحقاق</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer>
            <BarChart data={gap}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Bar dataKey="inflow" fill="var(--chart-1)" name="التدفق الداخل" stackId="i" />
              <Bar dataKey="outflow" fill="var(--chart-4)" name="التدفق الخارج" stackId="o" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشريحة</TableHead>
                <TableHead className="text-right">التدفق الداخل</TableHead>
                <TableHead className="text-right">التدفق الخارج</TableHead>
                <TableHead className="text-right">الفجوة</TableHead>
                <TableHead className="text-right">التراكمي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gap.map((r) => (
                <TableRow key={r.bucket}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.inflow)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.outflow)}</TableCell>
                  <TableCell className={"text-right " + (r.gap < 0 ? "text-destructive" : "text-emerald-500")}>{fmtMoney(r.gap)}</TableCell>
                  <TableCell className={"text-right font-semibold " + (r.cumulative < 0 ? "text-destructive" : "text-emerald-500")}>{fmtMoney(r.cumulative)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
