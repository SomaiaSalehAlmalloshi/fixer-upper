import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  TIER_LABEL, computeLCR, fmtMoney, fmtPct, listCashFlows, listHqla, ratioColor,
} from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/lcr")({
  component: LcrPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

function LcrPage() {
  const { data: hqla = [] } = useQuery({ queryKey: ["liq", "hqla"], queryFn: listHqla });
  const { data: flows = [] } = useQuery({ queryKey: ["liq", "cashflows"], queryFn: listCashFlows });
  const r = computeLCR(hqla, flows);

  const composition = [
    { name: TIER_LABEL.level1, value: r.hqla.level1 },
    { name: TIER_LABEL.level2a, value: r.hqla.level2a },
    { name: TIER_LABEL.level2b, value: r.hqla.l2b_capped },
  ];
  const cf = [
    { name: "Outflows", value: r.cashflows.outflow },
    { name: "Inflows (capped)", value: r.cashflows.capped_inflow },
    { name: "Net outflow", value: r.cashflows.net },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="LCR" value={isFinite(r.lcr) ? fmtPct(r.lcr, 0) : "∞"} cls={ratioColor(r.lcr)} />
        <Kpi label="Regulatory minimum" value="100%" />
        <Kpi label="HQLA (net)" value={fmtMoney(r.hqla.total)} />
        <Kpi label="Net outflows 30d" value={fmtMoney(r.cashflows.net)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>HQLA composition (post-cap)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={composition} dataKey="value" nameKey="name" outerRadius={90} label>
                  {composition.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>30-day cash flow (stressed)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={cf}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="value" fill="var(--chart-4)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>التفسير</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><b>الصيغة:</b> LCR = HQLA / Net cash outflows over 30 days.</p>
          <p>Level 2 assets are capped at 40% of total HQLA; Level 2B at 15%. Inflows are capped at 75% of outflows.</p>
          <p>The regulatory floor is 100%. Current ratio: <span className={ratioColor(r.lcr)}>{isFinite(r.lcr) ? fmtPct(r.lcr, 1) : "∞"}</span>.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, cls }: { label: string; value: React.ReactNode; cls?: string }) {
  return <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">{label}</div><div className={"mt-2 text-2xl font-semibold " + (cls ?? "")}>{value}</div></CardContent></Card>;
}
