import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets, Gauge, Landmark, TrendingDown } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  TIER_LABEL, computeHqla, computeLCR, computeLiquidityGap, computeNSFR,
  fmtMoney, fmtPct, listCashFlows, listFundingSources, listHqla, ratioColor,
} from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/")({
  component: LiquidityOverview,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function LiquidityOverview() {
  const { data: hqla = [] } = useQuery({ queryKey: ["liq", "hqla"], queryFn: listHqla });
  const { data: flows = [] } = useQuery({ queryKey: ["liq", "cashflows"], queryFn: listCashFlows });
  const { data: sources = [] } = useQuery({ queryKey: ["liq", "funding"], queryFn: listFundingSources });

  const lcrRes = computeLCR(hqla, flows);
  const nsfrRes = computeNSFR(sources);
  const gap = computeLiquidityGap(flows);
  const hqlaC = computeHqla(hqla);

  const tierData = [
    { name: TIER_LABEL.level1, value: hqlaC.level1 },
    { name: TIER_LABEL.level2a, value: hqlaC.level2a },
    { name: TIER_LABEL.level2b, value: hqlaC.l2b_capped },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Gauge} label="LCR" value={isFinite(lcrRes.lcr) ? fmtPct(lcrRes.lcr, 0) : "∞"} cls={ratioColor(lcrRes.lcr)} sub="Min 100%" />
        <Stat icon={Landmark} label="NSFR" value={isFinite(nsfrRes.nsfr) ? fmtPct(nsfrRes.nsfr, 0) : "∞"} cls={ratioColor(nsfrRes.nsfr)} sub="Min 100%" />
        <Stat icon={Droplets} label="Total HQLA" value={fmtMoney(hqlaC.total)} sub={`L1: ${fmtMoney(hqlaC.level1)}`} />
        <Stat icon={TrendingDown} label="Net Outflow 30d" value={fmtMoney(lcrRes.cashflows.net)} sub={`Inflows capped ${fmtMoney(lcrRes.cashflows.capped_inflow)}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>HQLA composition (post-cap)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={tierData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {tierData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>الفجوة التراكمية للسيولة</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={gap}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend />
                <Line type="monotone" dataKey="gap" stroke="var(--chart-2)" name="فجوة الشريحة" />
                <Line type="monotone" dataKey="cumulative" stroke="var(--chart-1)" strokeWidth={2} name="التراكمي" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Inflows vs Outflows per bucket</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={gap}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Bar dataKey="inflow" fill="var(--chart-1)" name="التدفق الداخل" />
              <Bar dataKey="outflow" fill="var(--chart-4)" name="التدفق الخارج" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, cls }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; cls?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
        <div className={"mt-2 text-2xl font-semibold " + (cls ?? "")}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
