import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ai")({
  component: AiLayout,
});

type Nav = { to: string; label: string; exact?: boolean };
const SUB_NAV: Nav[] = [
  { to: "/ai", label: "Executive Summary", exact: true },
  { to: "/ai/risk", label: "Risk Summary" },
  { to: "/ai/compliance", label: "Compliance Advisor" },
  { to: "/ai/liquidity", label: "Liquidity Advisor" },
  { to: "/ai/capital", label: "Capital Advisor" },
  { to: "/ai/fraud", label: "Fraud Detection" },
  { to: "/ai/prediction", label: "Risk Prediction" },
  { to: "/ai/recommendations", label: "التوصيات" },
  { to: "/ai/query", label: "Natural Language Query" },
];

function AiLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">المستشارون بالذكاء الاصطناعي</h1>
        <p className="text-muted-foreground">
          AI-driven analysis across the entire risk suite. Reuses live capital, liquidity, credit, market, operational and compliance data.
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b">
        {SUB_NAV.map((n) => {
          const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to as never}
              className={cn(
                "border-b-2 px-3 py-2 text-sm transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
