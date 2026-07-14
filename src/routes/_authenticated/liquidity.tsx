import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/liquidity")({
  component: LiquidityLayout,
});

type Nav = { to: string; label: string; exact?: boolean };
const SUB_NAV: Nav[] = [
  { to: "/liquidity", label: "نظرة عامة", exact: true },
  { to: "/liquidity/lcr", label: "LCR" },
  { to: "/liquidity/nsfr", label: "NSFR" },
  { to: "/liquidity/hqla", label: "HQLA" },
  { to: "/liquidity/cashflow", label: "Cash Flow" },
  { to: "/liquidity/buckets", label: "Buckets" },
  { to: "/liquidity/funding", label: "التمويل" },
  { to: "/liquidity/gap", label: "Liquidity Gap" },
  { to: "/liquidity/stress", label: "الضغط" },
  { to: "/liquidity/reports", label: "التقارير" },
];

function LiquidityLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Liquidity Management</h1>
        <p className="text-muted-foreground">
          LCR, NSFR, HQLA, cash flow buckets, funding sources, liquidity gap and stress testing.
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
