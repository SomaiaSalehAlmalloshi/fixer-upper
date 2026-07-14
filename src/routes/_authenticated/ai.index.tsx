import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AiPanel } from "@/components/ai/AiPanel";
import { PROMPTS, buildSnapshot } from "@/lib/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/ai/")({
  component: ExecutiveSummary,
});

function fmtMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number) {
  return isFinite(n) ? (n * 100).toFixed(1) + "%" : "∞";
}

function ExecutiveSummary() {
  const { data: snap } = useQuery({ queryKey: ["ai", "snapshot"], queryFn: buildSnapshot });

  return (
    <div className="space-y-6">
      {snap && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total RWA" value={fmtMoney(snap.capital.totalRwa)} sub={`${snap.capital.approvedAssets} approved assets`} />
          <Kpi label="LCR" value={fmtPct(snap.liquidity.lcr)} sub={`NSFR ${fmtPct(snap.liquidity.nsfr)}`} />
          <Kpi label="نسبة القروض المتعثّرة" value={fmtPct(snap.credit.nplRatio)} sub={`${snap.credit.loanCount} loans`} />
          <Kpi label="الامتثال" value={`${snap.compliance.failing} fail / ${snap.compliance.warning} warn`} sub={`${snap.compliance.openTasks} open tasks`} />
        </div>
      )}
      <AiPanel
        title="Executive Summary"
        description="Board-ready one-page narrative synthesised from live enterprise risk data."
        purpose="executive_summary"
        system={PROMPTS.executive}
        buildUserPrompt={async () => `Enterprise Risk Snapshot:\n${JSON.stringify(snap ?? (await buildSnapshot()), null, 2)}`}
      />
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}
