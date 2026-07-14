import { createFileRoute } from "@tanstack/react-router";
import { AssetClassView } from "@/components/market/AssetClassView";
import { fmtMoney } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/market/fx")({
  component: FxRiskPage,
});

function FxRiskPage() {
  return (
    <AssetClassView
      assetClass="fx"
      title="مخاطر العملات"
      description="Foreign-exchange exposure by currency pair, including net open positions and volatility."
      groupBy={(p) => p.currency}
      groupLabel="Currency"
      extraMetrics={(positions) => {
        const net: Record<string, number> = {};
        for (const p of positions) {
          net[p.currency] = (net[p.currency] ?? 0) + Number(p.market_value);
        }
        const long = Object.values(net).filter((x) => x > 0).reduce((s, x) => s + x, 0);
        const short = Object.values(net).filter((x) => x < 0).reduce((s, x) => s + x, 0);
        return [
          { label: "Long exposure", value: fmtMoney(long) },
          { label: "Short exposure", value: fmtMoney(Math.abs(short)) },
          { label: "Net exposure", value: fmtMoney(long + short) },
          { label: "Currencies", value: Object.keys(net).length.toString() },
        ];
      }}
    />
  );
}
