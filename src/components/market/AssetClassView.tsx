import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ASSET_LABEL, fmtMoney, fmtNum, fmtPct, listPositions, parametricVaR,
  type Position,
} from "@/lib/market";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type AssetClass = keyof typeof ASSET_LABEL;

type ExtraMetric = { label: string; value: string };

interface Props {
  assetClass: AssetClass;
  title: string;
  description: string;
  extraMetrics?: (positions: Position[]) => ExtraMetric[];
  groupBy?: (p: Position) => string;
  groupLabel?: string;
}

export function AssetClassView({ assetClass, title, description, extraMetrics, groupBy, groupLabel = "الشريحة" }: Props) {
  const { data: all = [] } = useQuery({ queryKey: ["market", "positions"], queryFn: listPositions });
  const positions = useMemo(() => all.filter((p) => p.asset_class === assetClass), [all, assetClass]);

  const totalMv = positions.reduce((s, p) => s + Number(p.market_value), 0);
  const totalNotional = positions.reduce((s, p) => s + Number(p.notional), 0);
  const totalSens = positions.reduce((s, p) => s + Number(p.sensitivity), 0);
  const avgVol = positions.length
    ? positions.reduce((s, p) => s + Number(p.volatility), 0) / positions.length
    : 0;
  const v = parametricVaR(positions, 0.99, 1);

  const groups = useMemo(() => {
    if (!groupBy) return [];
    const map = new Map<string, { name: string; mv: number; sens: number }>();
    for (const p of positions) {
      const key = groupBy(p) || "—";
      const cur = map.get(key) ?? { name: key, mv: 0, sens: 0 };
      cur.mv += Number(p.market_value);
      cur.sens += Number(p.sensitivity);
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.mv - a.mv);
  }, [positions, groupBy]);

  const extras = extraMetrics?.(positions) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="المراكز" value={positions.length.toString()} />
        <Stat label="القيمة السوقية" value={fmtMoney(totalMv)} />
        <Stat label="القيمة الاسمية" value={fmtMoney(totalNotional)} />
        <Stat label="1-day 99% VaR" value={fmtMoney(v.varAmount)} accent />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="1% Sensitivity" value={fmtMoney(totalSens)} />
        <Stat label="Portfolio σ" value={fmtMoney(v.sigma)} />
        <Stat label="Expected Shortfall (99%)" value={fmtMoney(v.esAmount)} accent />
        <Stat label="Avg volatility" value={fmtPct(avgVol)} />
        {extras.map((e) => <Stat key={e.label} label={e.label} value={e.value} />)}
      </div>

      {groupBy && groups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Exposure by {groupLabel.toLowerCase()}</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groups}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(x) => `${(x / 1_000_000).toFixed(1)}M`} />
                  <Tooltip formatter={(x: number) => fmtMoney(x)} />
                  <Legend />
                  <Bar dataKey="mv" name="Market value" fill="var(--chart-1)" />
                  <Bar dataKey="sens" name="الحساسية" fill="var(--chart-2)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Mix</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={groups} dataKey="mv" nameKey="name" outerRadius={90} label>
                    {groups.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(x: number) => fmtMoney(x)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>المراكز</CardTitle></CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No {ASSET_LABEL[assetClass]} positions yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>المحفظة</TableHead>
                  <TableHead>Ccy</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">القيمة السوقية</TableHead>
                  <TableHead className="text-right">التقلّب</TableHead>
                  <TableHead className="text-right">الحساسية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.portfolio}</Badge></TableCell>
                    <TableCell>{p.currency}</TableCell>
                    <TableCell className="text-right">{fmtNum(p.quantity)}</TableCell>
                    <TableCell className="text-right">{fmtNum(p.price, 4)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(p.market_value)}</TableCell>
                    <TableCell className="text-right">{fmtPct(p.volatility)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(p.sensitivity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}
