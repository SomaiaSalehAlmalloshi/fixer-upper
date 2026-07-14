import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { ASSET_LABEL, VAR_METHODS, fmtMoney, listPositions, listVarRuns, parametricVaR, saveVarRun } from "@/lib/market";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/market/var")({
  component: VarPage,
});

function VarPage() {
  const qc = useQueryClient();
  const { user, canWrite } = useAuth();
  const { data: positions = [] } = useQuery({ queryKey: ["market", "positions"], queryFn: listPositions });
  const { data: runs = [] } = useQuery({ queryKey: ["market", "var-runs"], queryFn: listVarRuns });

  const [confidence, setConfidence] = useState(0.99);
  const [horizon, setHorizon] = useState(1);
  const [method, setMethod] = useState<(typeof VAR_METHODS)[number]>("parametric");
  const [name, setName] = useState("Daily VaR");

  const result = useMemo(() => parametricVaR(positions, confidence, horizon), [positions, confidence, horizon]);
  const chart = Object.entries(result.breakdown).map(([k, v]) => ({ name: ASSET_LABEL[k as keyof typeof ASSET_LABEL] ?? k, var: v }));

  const save = useMutation({
    mutationFn: async () => saveVarRun({
      name, method, confidence, horizon_days: horizon,
      portfolio_mv: result.portfolioMv, portfolio_volatility: result.sigma,
      var_amount: result.varAmount, es_amount: result.esAmount,
      breakdown: result.breakdown,
      run_by: user!.id,
    }),
    onSuccess: () => { toast.success("Run saved"); qc.invalidateQueries({ queryKey: ["market", "var-runs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Value at Risk calculator</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div><Label className="text-xs uppercase text-muted-foreground">الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs uppercase text-muted-foreground">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VAR_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs uppercase text-muted-foreground">Confidence</Label>
            <Select value={String(confidence)} onValueChange={(v) => setConfidence(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.9">90%</SelectItem>
                <SelectItem value="0.95">95%</SelectItem>
                <SelectItem value="0.99">99%</SelectItem>
                <SelectItem value="0.999">99.9%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs uppercase text-muted-foreground">Horizon (days)</Label><Input type="number" min={1} value={horizon} onChange={(e) => setHorizon(Math.max(1, Number(e.target.value)))} /></div>
          <div className="flex items-end">{canWrite && <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !positions.length}>Save run</Button>}</div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Portfolio MV" value={fmtMoney(result.portfolioMv)} />
        <Stat label="Portfolio σ" value={fmtMoney(result.sigma)} />
        <Stat label={`VaR (${(confidence * 100).toFixed(1)}%)`} value={fmtMoney(result.varAmount)} accent />
        <Stat label="Expected Shortfall" value={fmtMoney(result.esAmount)} accent />
      </div>

      <Card>
        <CardHeader><CardTitle>VaR contribution by asset class</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `${(v / 1_000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Bar dataKey="var" fill="var(--chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historical runs</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead className="text-right">Horizon</TableHead>
                <TableHead className="text-right">Portfolio MV</TableHead>
                <TableHead className="text-right">القيمة المعرّضة للمخاطر (VaR)</TableHead>
                <TableHead className="text-right">ES</TableHead>
                <TableHead>الوقت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.method}</TableCell>
                  <TableCell className="text-right">{(Number(r.confidence) * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{r.horizon_days}d</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.portfolio_mv)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtMoney(r.var_amount)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.es_amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.run_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!runs.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No runs saved.</TableCell></TableRow>}
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