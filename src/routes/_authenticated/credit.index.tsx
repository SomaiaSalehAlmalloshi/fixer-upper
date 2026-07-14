import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMoney, listLoans, listBorrowers, listWarnings, loadPortfolio } from "@/lib/credit";
import { Users, Coins, ShieldAlert, TrendingDown } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
  PieChart, Pie, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/credit/")({
  component: Overview,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Overview() {
  const { data: borrowers = [] } = useQuery({ queryKey: ["credit", "borrowers"], queryFn: listBorrowers });
  const { data: loans = [] } = useQuery({ queryKey: ["credit", "loans"], queryFn: listLoans });
  const { data: warnings = [] } = useQuery({ queryKey: ["credit", "warnings"], queryFn: listWarnings });
  const { data: portfolio = [] } = useQuery({ queryKey: ["credit", "portfolio"], queryFn: loadPortfolio });

  const totalEad = loans.reduce((s, l) => s + Number(l.ead), 0);
  const totalEl = loans.reduce((s, l) => s + Number(l.expected_loss), 0);
  const totalOutstanding = loans.reduce((s, l) => s + Number(l.outstanding), 0);
  const openWarnings = warnings.filter((w) => w.status === "open").length;

  const byRating = Array.from(
    portfolio.reduce((m, r) => {
      const k = r.credit_rating ?? "NR";
      const prev = m.get(k) ?? { rating: k, ead: 0, el: 0 };
      prev.ead += Number(r.total_ead);
      prev.el += Number(r.total_el);
      m.set(k, prev);
      return m;
    }, new Map<string, { rating: string; ead: number; el: number }>()),
  ).map(([, v]) => v).sort((a, b) => b.ead - a.ead);

  const byIndustry = Array.from(
    portfolio.reduce((m, r) => {
      const k = r.industry ?? "Unclassified";
      m.set(k, (m.get(k) ?? 0) + Number(r.total_ead));
      return m;
    }, new Map<string, number>()),
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Users} label="المقترضون" value={borrowers.length} />
        <Stat icon={Coins} label="Total Outstanding" value={fmtMoney(totalOutstanding)} />
        <Stat icon={TrendingDown} label="Total EAD" value={fmtMoney(totalEad)} />
        <Stat icon={ShieldAlert} label="Expected Loss" value={fmtMoney(totalEl)} accent />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>EAD by rating</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRating}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="ead" fill="var(--chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>EAD by industry</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byIndustry} dataKey="value" nameKey="name" outerRadius={90} label>
                  {byIndustry.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent warnings ({openWarnings} open)</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {warnings.slice(0, 8).map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="mr-2 inline-flex rounded bg-secondary px-2 py-0.5 text-xs uppercase">{w.severity}</span>
                  {w.message ?? w.signal_type}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(w.triggered_at).toLocaleString()}</span>
              </li>
            ))}
            {!warnings.length && <li className="py-3 text-sm text-muted-foreground">No warnings yet.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}