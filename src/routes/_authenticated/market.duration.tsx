import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney, fmtNum, listPositions } from "@/lib/market";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/market/duration")({
  component: DurationPage,
});

function DurationPage() {
  const { data: positions = [] } = useQuery({ queryKey: ["market", "positions"], queryFn: listPositions });
  const ir = positions.filter((p) => p.asset_class === "ir");

  const totalMv = ir.reduce((s, p) => s + Number(p.market_value), 0);
  const totalDv01 = ir.reduce((s, p) => s + Number(p.dv01), 0);
  const weighted = totalMv > 0
    ? ir.reduce((s, p) => s + Number(p.duration) * Number(p.market_value), 0) / totalMv
    : 0;

  const chart = ir.map((p) => ({ name: p.position_code, dv01: Number(p.dv01), duration: Number(p.duration) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="IR positions" value={ir.length} />
        <Stat label="Weighted duration" value={`${fmtNum(weighted, 2)} yrs`} />
        <Stat label="Total DV01" value={fmtMoney(totalDv01)} accent />
      </div>
      <Card>
        <CardHeader><CardTitle>DV01 by position</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v: number, k) => k === "dv01" ? fmtMoney(v) : fmtNum(v, 2)} />
              <Bar dataKey="dv01" fill="var(--chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Fixed-income positions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead className="text-right">MV</TableHead>
                <TableHead className="text-right">المدة</TableHead>
                <TableHead className="text-right">Convexity</TableHead>
                <TableHead className="text-right">Coupon</TableHead>
                <TableHead className="text-right">DV01</TableHead>
                <TableHead>Maturity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ir.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.position_code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right">{fmtMoney(p.market_value, p.currency)}</TableCell>
                  <TableCell className="text-right">{fmtNum(p.duration, 2)}</TableCell>
                  <TableCell className="text-right">{fmtNum(p.convexity, 2)}</TableCell>
                  <TableCell className="text-right">{(Number(p.coupon_rate) * 100).toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-medium">{fmtMoney(p.dv01, p.currency)}</TableCell>
                  <TableCell>{p.maturity_date ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!ir.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No fixed-income positions.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card><CardContent className="p-5">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
    </CardContent></Card>
  );
}