import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/market")({
  component: MarketLayout,
});

type NavItem = { to: string; label: string; exact?: boolean };
const SUB_NAV: NavItem[] = [
  { to: "/market", label: "نظرة عامة", exact: true },
  { to: "/market/positions", label: "المراكز" },
  { to: "/market/fx", label: "العملات الأجنبية" },
  { to: "/market/ir", label: "أسعار الفائدة" },
  { to: "/market/commodity", label: "السلع" },
  { to: "/market/equity", label: "الأسهم" },
  { to: "/market/var", label: "القيمة المعرّضة للمخاطر (VaR)" },
  { to: "/market/duration", label: "المدة" },
  { to: "/market/sensitivity", label: "الحساسية" },
  { to: "/market/scenarios", label: "السيناريوهات" },
  { to: "/market/reports", label: "التقارير" },
];

function MarketLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">مخاطر السوق</h1>
        <p className="text-muted-foreground">FX, interest rate, equity and commodity risk with VaR, duration and sensitivity analysis.</p>
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