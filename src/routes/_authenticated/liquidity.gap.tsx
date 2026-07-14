import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Area, AreaChart,
} from "recharts";
import { computeLiquidityGap, fmtMoney, listCashFlows } from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/gap")({
  component: GapPage,
});

function GapPage() {
  const { data: flows = [] } = useQuery({ queryKey: ["liq", "cashflows"], queryFn: listCashFlows });
  const gap = computeLiquidityGap(flows);
  const minCum = Math.min(...gap.map((g) => g.cumulative), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">أعمق فجوة تراكمية</div><div className={"mt-2 text-2xl font-semibold " + (minCum < 0 ? "text-destructive" : "text-emerald-500")}>{fmtMoney(minCum)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">صافي الفجوة الإجمالي</div><div className="mt-2 text-2xl font-semibold">{fmtMoney(gap[gap.length - 1]?.cumulative ?? 0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>الفجوة التراكمية للسيولة</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer>
            <AreaChart data={gap}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Area type="monotone" dataKey="cumulative" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.3} name="الفجوة التراكمية" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الفجوة لكل شريحة</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <LineChart data={gap}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Line type="monotone" dataKey="gap" stroke="var(--chart-2)" strokeWidth={2} name="فجوة الشريحة" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
