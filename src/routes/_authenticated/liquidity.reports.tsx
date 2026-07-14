import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TIER_LABEL, computeHqla, computeLCR, computeLiquidityGap, computeNSFR,
  fmtMoney, fmtPct, listCashFlows, listFundingSources, listHqla, ratioColor,
} from "@/lib/liquidity";

export const Route = createFileRoute("/_authenticated/liquidity/reports")({
  component: ReportsPage,
});

function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}
function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ReportsPage() {
  const { data: hqla = [] } = useQuery({ queryKey: ["liq", "hqla"], queryFn: listHqla });
  const { data: flows = [] } = useQuery({ queryKey: ["liq", "cashflows"], queryFn: listCashFlows });
  const { data: sources = [] } = useQuery({ queryKey: ["liq", "funding"], queryFn: listFundingSources });

  const lcr = computeLCR(hqla, flows);
  const nsfr = computeNSFR(sources);
  const gap = computeLiquidityGap(flows);
  const h = computeHqla(hqla);

  const exportGap = () => download("liquidity_gap.csv", toCsv([
    ["الشريحة", "التدفق الداخل", "التدفق الخارج", "الفجوة", "التراكمي"],
    ...gap.map((g) => [g.label, g.inflow, g.outflow, g.gap, g.cumulative]),
  ]));
  const exportHqla = () => download("hqla.csv", toCsv([
    ["الاسم", "Tier", "Currency", "MarketValue", "Haircut", "Eligible", "Encumbered"],
    ...hqla.map((a) => [a.name, TIER_LABEL[a.tier], a.currency, a.market_value, a.haircut, a.eligible_value, a.encumbered ? "Y" : "N"]),
  ]));
  const exportFunding = () => download("funding.csv", toCsv([
    ["الاسم", "النوع", "Currency", "المبلغ", "Tenor", "Stable", "التمويل المستقر المتاح (ASF)", "التمويل المستقر المطلوب (RSF)"],
    ...sources.map((s) => [s.name, s.source_type, s.currency, s.amount, s.tenor_days, s.stable ? "Y" : "N", s.asf_factor, s.rsf_factor]),
  ]));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Regulatory ratios</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Ratio</TableHead><TableHead className="text-right">القيمة</TableHead><TableHead className="text-right">Minimum</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell>LCR</TableCell><TableCell className={"text-right font-semibold " + ratioColor(lcr.lcr)}>{isFinite(lcr.lcr) ? fmtPct(lcr.lcr, 1) : "∞"}</TableCell><TableCell className="text-right">100%</TableCell></TableRow>
                <TableRow><TableCell>NSFR</TableCell><TableCell className={"text-right font-semibold " + ratioColor(nsfr.nsfr)}>{isFinite(nsfr.nsfr) ? fmtPct(nsfr.nsfr, 1) : "∞"}</TableCell><TableCell className="text-right">100%</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Balance sheet liquidity</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow><TableCell>Total HQLA</TableCell><TableCell className="text-right">{fmtMoney(h.total)}</TableCell></TableRow>
                <TableRow><TableCell>Level 1</TableCell><TableCell className="text-right">{fmtMoney(h.level1)}</TableCell></TableRow>
                <TableRow><TableCell>Level 2A</TableCell><TableCell className="text-right">{fmtMoney(h.level2a)}</TableCell></TableRow>
                <TableRow><TableCell>Level 2B (capped)</TableCell><TableCell className="text-right">{fmtMoney(h.l2b_capped)}</TableCell></TableRow>
                <TableRow><TableCell>التمويل المستقر المتاح (ASF)</TableCell><TableCell className="text-right">{fmtMoney(nsfr.asf)}</TableCell></TableRow>
                <TableRow><TableCell>التمويل المستقر المطلوب (RSF)</TableCell><TableCell className="text-right">{fmtMoney(nsfr.rsf)}</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Exports</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportGap}><Download className="mr-2 h-4 w-4" /> Liquidity gap CSV</Button>
          <Button variant="outline" onClick={exportHqla}><Download className="mr-2 h-4 w-4" /> HQLA CSV</Button>
          <Button variant="outline" onClick={exportFunding}><Download className="mr-2 h-4 w-4" /> Funding CSV</Button>
        </CardContent>
      </Card>
    </div>
  );
}
