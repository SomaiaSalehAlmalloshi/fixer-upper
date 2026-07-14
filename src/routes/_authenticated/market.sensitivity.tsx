import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ASSET_LABEL, fmtMoney, listPositions, scenarioPnl } from "@/lib/market";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/market/sensitivity")({
  component: SensitivityPage,
});

function SensitivityPage() {
  const { data: positions = [] } = useQuery({ queryKey: ["market", "positions"], queryFn: listPositions });
  const [fx, setFx] = useState(1);
  const [ir, setIr] = useState(50);
  const [eq, setEq] = useState(-5);
  const [cm, setCm] = useState(10);

  const shocks = { fx_shock: fx / 100, ir_shock_bp: ir, equity_shock: eq / 100, commodity_shock: cm / 100 };
  const pnl = useMemo(() => scenarioPnl(positions, shocks), [positions, fx, ir, eq, cm]);

  const perPosition = positions.map((p) => ({
    name: p.position_code,
    pnl: scenarioPnl([p], shocks),
    class: ASSET_LABEL[p.asset_class],
  })).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Sensitivity shocks</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div><Label className="text-xs uppercase text-muted-foreground">FX shock (%)</Label><Input type="number" step="0.1" value={fx} onChange={(e) => setFx(Number(e.target.value))} /></div>
          <div><Label className="text-xs uppercase text-muted-foreground">Rates shift (bp)</Label><Input type="number" step="1" value={ir} onChange={(e) => setIr(Number(e.target.value))} /></div>
          <div><Label className="text-xs uppercase text-muted-foreground">Equity shock (%)</Label><Input type="number" step="0.1" value={eq} onChange={(e) => setEq(Number(e.target.value))} /></div>
          <div><Label className="text-xs uppercase text-muted-foreground">Commodity shock (%)</Label><Input type="number" step="0.1" value={cm} onChange={(e) => setCm(Number(e.target.value))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Total P&L impact</div>
          <div className={"mt-2 text-3xl font-semibold " + (pnl < 0 ? "text-destructive" : "text-primary")}>{fmtMoney(pnl)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Per-position P&L</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perPosition.slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Bar dataKey="pnl" fill="var(--chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Class</TableHead><TableHead className="text-right">الربح والخسارة</TableHead></TableRow></TableHeader>
            <TableBody>
              {perPosition.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-mono text-xs">{p.name}</TableCell>
                  <TableCell>{p.class}</TableCell>
                  <TableCell className={"text-right font-medium " + (p.pnl < 0 ? "text-destructive" : "")}>{fmtMoney(p.pnl)}</TableCell>
                </TableRow>
              ))}
              {!perPosition.length && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No positions.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}