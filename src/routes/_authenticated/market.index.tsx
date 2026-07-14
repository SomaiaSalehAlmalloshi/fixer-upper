import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ASSET_LABEL, fmtMoney, fmtNum, listPositions, loadMarketSummary, parametricVaR } from "@/lib/market";
import { TrendingUp, Layers, Activity, Gauge } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/market/")({
  component: MarketOverview,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function MarketOverview() {
  const { data: positions = [] } = useQuery({ queryKey: ["market", "positions"], queryFn: listPositions });
  const { data: summary = [] } = useQuery({ queryKey: ["market", "summary"], queryFn: loadMarketSummary });

  const totalMv = positions.reduce((s, p) => s + Number(p.market_value), 0);
  const totalDv01 = positions.reduce((s, p) => s + Number(p.dv01), 0);
  const totalSens = positions.reduce((s, p) => s + Number(p.sensitivity), 0);
  const v = parametricVaR(positions, 0.99, 1);

  const byClass = summary.map((r) => ({
    name: ASSET_LABEL[(r.asset_class ?? "fx") as keyof typeof ASSET_LABEL] ?? r.asset_class,
    mv: Number(r.total_mv),
    sens: Number(r.total_sensitivity),
  }));
  const pie = byClass.map((b) => ({ name: b.name, value: b.mv }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Layers} label="المراكز" value={positions.length} />
        <Stat icon={TrendingUp} label="القيمة السوقية" value={fmtMoney(totalMv)} />
        <Stat icon={Gauge} label="DV01" value={fmtMoney(totalDv01)} />
        <Stat icon={Activity} label="1-day 99% VaR" value={fmtMoney(v.varAmount)} accent />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Exposure by asset class</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(x) => `${(x / 1_000_000).toFixed(0)}M`} />
                <Tooltip formatter={(x: number) => fmtMoney(x)} />
                <Bar dataKey="mv" fill="var(--chart-1)" name="Market value" />
                <Bar dataKey="sens" fill="var(--chart-2)" name="الحساسية" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Mix</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" outerRadius={90} label>
                  {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip formatter={(x: number) => fmtMoney(x)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Portfolio risk metrics</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <div><div className="text-xs uppercase text-muted-foreground">Portfolio σ</div><div className="mt-1 font-medium">{fmtMoney(v.sigma)}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Expected Shortfall (99%)</div><div className="mt-1 font-medium">{fmtMoney(v.esAmount)}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Total 1% sensitivity</div><div className="mt-1 font-medium">{fmtMoney(totalSens)}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Avg volatility</div><div className="mt-1 font-medium">{fmtNum(summary.reduce((s, r) => s + Number(r.avg_volatility), 0) / Math.max(summary.length, 1), 4)}</div></div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
        <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}