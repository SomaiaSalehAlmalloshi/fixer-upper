import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { loadAssets, fmtMoney, type Asset } from "@/lib/rwa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Coins, TrendingUp, Activity, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CAT_COLORS = { credit: "var(--chart-1)", market: "var(--chart-2)", operational: "var(--chart-3)" };

function Dashboard() {
  const { data: assets = [], isLoading } = useQuery({ queryKey: ["assets"], queryFn: () => loadAssets() });

  const byCat = ["credit", "market", "operational"].map((c) => {
    const list = assets.filter((a) => a.category === c && a.status === "approved");
    return { category: c, rwa: list.reduce((s, a) => s + Number(a.rwa_amount), 0), exposure: list.reduce((s, a) => s + Number(a.exposure_amount), 0) };
  });
  const totalRWA = byCat.reduce((s, x) => s + x.rwa, 0);
  const totalExposure = byCat.reduce((s, x) => s + x.exposure, 0);
  const pending = assets.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground">نظرة عامة على محفظة الأصول المرجّحة بالمخاطر</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={Shield} label="إجمالي الأصول المرجّحة (المعتمدة)" value={fmtMoney(totalRWA)} />
        <Kpi icon={Coins} label="إجمالي التعرّض" value={fmtMoney(totalExposure)} />
        <Kpi icon={TrendingUp} label="الأصول" value={String(assets.length)} />
        <Kpi icon={Activity} label="بانتظار الاعتماد" value={String(pending)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>الأصول المرجّحة حسب الفئة</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byCat}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="category" />
                <YAxis tickFormatter={(v) => (v / 1_000_000).toFixed(0) + "M"} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="rwa" radius={[4, 4, 0, 0]}>
                  {byCat.map((d) => (
                    <Cell key={d.category} fill={CAT_COLORS[d.category as keyof typeof CAT_COLORS]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>التوزيع</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCat.filter((d) => d.rwa > 0)} dataKey="rwa" nameKey="category" outerRadius={90} label>
                  {byCat.map((d) => (
                    <Cell key={d.category} fill={CAT_COLORS[d.category as keyof typeof CAT_COLORS]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <RecentAssets assets={assets.slice(0, 8)} loading={isLoading} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentAssets({ assets, loading }: { assets: Asset[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle>Recent assets</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">جاري التحميل…</div>
        ) : assets.length === 0 ? (
          <div className="text-sm text-muted-foreground">No assets yet — add one from the Credit / Market / Operational pages.</div>
        ) : (
          <div className="divide-y">
            {assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.category} · {a.asset_class} · {a.status}</div>
                </div>
                <div className="text-right">
                  <div>{fmtMoney(Number(a.rwa_amount), a.currency)}</div>
                  <div className="text-xs text-muted-foreground">RW {(Number(a.risk_weight) * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
