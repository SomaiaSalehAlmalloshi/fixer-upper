import { createFileRoute } from "@tanstack/react-router";
import { AssetClassView } from "@/components/market/AssetClassView";
import { fmtMoney, fmtNum } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/market/ir")({
  component: IrRiskPage,
});

function bucket(d: number) {
  if (d < 1) return "0–1y";
  if (d < 3) return "1–3y";
  if (d < 5) return "3–5y";
  if (d < 7) return "5–7y";
  if (d < 10) return "7–10y";
  return "10y+";
}

function IrRiskPage() {
  return (
    <AssetClassView
      assetClass="ir"
      title="مخاطر أسعار الفائدة"
      description="Duration, DV01 and convexity exposure across the yield curve."
      groupBy={(p) => bucket(Number(p.duration))}
      groupLabel="Tenor bucket"
      extraMetrics={(positions) => {
        const totalDv01 = positions.reduce((s, p) => s + Number(p.dv01), 0);
        const mv = positions.reduce((s, p) => s + Number(p.market_value), 0);
        const wDur = mv
          ? positions.reduce((s, p) => s + Number(p.duration) * Number(p.market_value), 0) / mv
          : 0;
        const wConv = mv
          ? positions.reduce((s, p) => s + Number(p.convexity) * Number(p.market_value), 0) / mv
          : 0;
        const shock100 = -totalDv01 * 100;
        return [
          { label: "Total DV01", value: fmtMoney(totalDv01) },
          { label: "Weighted duration", value: `${fmtNum(wDur, 2)}y` },
          { label: "Weighted convexity", value: fmtNum(wConv, 3) },
          { label: "P&L on +100bp", value: fmtMoney(shock100) },
        ];
      }}
    />
  );
}
