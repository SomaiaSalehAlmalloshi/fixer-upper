import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  SOURCE_LABEL, computeNSFR, fmtMoney, fmtPct, listFundingSources, ratioColor,
  type FundingSourceType,
} from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/nsfr")({
  component: NsfrPage,
});

const TYPES: FundingSourceType[] = ["retail_deposits", "wholesale_deposits", "repo", "interbank", "bond", "equity", "other"];

function NsfrPage() {
  const { data: sources = [] } = useQuery({ queryKey: ["liq", "funding"], queryFn: listFundingSources });
  const r = computeNSFR(sources);

  const byType = TYPES.map((t) => {
    const rows = sources.filter((s) => s.source_type === t);
    const asf = rows.reduce((a, s) => a + Number(s.amount) * Number(s.asf_factor), 0);
    const rsf = rows.reduce((a, s) => a + Number(s.amount) * Number(s.rsf_factor), 0);
    return { name: SOURCE_LABEL[t], asf, rsf };
  }).filter((x) => x.asf + x.rsf > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="NSFR" value={isFinite(r.nsfr) ? fmtPct(r.nsfr, 0) : "∞"} cls={ratioColor(r.nsfr)} />
        <Kpi label="الحد التنظيمي الأدنى" value="100%" />
        <Kpi label="التمويل المستقر المتاح (ASF)" value={fmtMoney(r.asf)} />
        <Kpi label="التمويل المستقر المطلوب (RSF)" value={fmtMoney(r.rsf)} />
      </div>

      <Card>
        <CardHeader><CardTitle>ASF مقابل RSF حسب نوع المصدر</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer>
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Bar dataKey="asf" fill="var(--chart-1)" name="التمويل المستقر المتاح" />
              <Bar dataKey="rsf" fill="var(--chart-4)" name="التمويل المستقر المطلوب" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>التفسير</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><b>الصيغة:</b> NSFR = التمويل المستقر المتاح (ASF) / التمويل المستقر المطلوب (RSF).</p>
          <p>لكل مصدر تمويل معامل ASF (وزن الاستقرار) ومعامل RSF (متطلبات تمويل الأصول التي يدعمها). الحد التنظيمي الأدنى 100%.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, cls }: { label: string; value: React.ReactNode; cls?: string }) {
  return <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">{label}</div><div className={"mt-2 text-2xl font-semibold " + (cls ?? "")}>{value}</div></CardContent></Card>;
}
