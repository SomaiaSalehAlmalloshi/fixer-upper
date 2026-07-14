import { createFileRoute } from "@tanstack/react-router";
import { AssetClassView } from "@/components/market/AssetClassView";
import { fmtMoney, fmtNum } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/market/equity")({
  component: EquityRiskPage,
});

function EquityRiskPage() {
  return (
    <AssetClassView
      assetClass="equity"
      title="مخاطر الأسهم"
      description="Equity exposure, beta-adjusted delta and market-shock sensitivities."
      groupBy={(p) => p.name}
      groupLabel="Ticker"
      extraMetrics={(positions) => {
        const mv = positions.reduce((s, p) => s + Number(p.market_value), 0);
        const betaDelta = positions.reduce(
          (s, p) => s + Number(p.beta) * Number(p.market_value),
          0,
        );
        const wBeta = mv ? betaDelta / mv : 0;
        const shock10 = betaDelta * 0.1;
        return [
          { label: "Beta-weighted delta", value: fmtMoney(betaDelta) },
          { label: "Weighted β", value: fmtNum(wBeta, 2) },
          { label: "P&L on market +10%", value: fmtMoney(shock10) },
          { label: "P&L on market −10%", value: fmtMoney(-shock10) },
        ];
      }}
    />
  );
}
