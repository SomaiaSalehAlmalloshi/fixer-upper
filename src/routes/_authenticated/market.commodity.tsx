import { createFileRoute } from "@tanstack/react-router";
import { AssetClassView } from "@/components/market/AssetClassView";
import { fmtMoney, fmtPct } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/market/commodity")({
  component: CommodityRiskPage,
});

function CommodityRiskPage() {
  return (
    <AssetClassView
      assetClass="commodity"
      title="مخاطر السلع"
      description="التعرّض للسلع حسب الأصل الأساسي مع حساسية الصدمات والتقلّب."
      groupBy={(p) => p.name}
      groupLabel="الأصل الأساسي"
      extraMetrics={(positions) => {
        const mv = positions.reduce((s, p) => s + Number(p.market_value), 0);
        const shock10 = mv * 0.1;
        const shockDown10 = -mv * 0.1;
        const avgVol = positions.length
          ? positions.reduce((s, p) => s + Number(p.volatility), 0) / positions.length
          : 0;
        const underlyings = new Set(positions.map((p) => p.name)).size;
        return [
          { label: "الربح والخسارة عند +10%", value: fmtMoney(shock10) },
          { label: "الربح والخسارة عند −10%", value: fmtMoney(shockDown10) },
          { label: "متوسط التقلّب", value: fmtPct(avgVol) },
          { label: "الأصول الأساسية", value: underlyings.toString() },
        ];
      }}
    />
  );
}
