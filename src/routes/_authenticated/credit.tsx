import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/credit")({
  component: CreditLayout,
});

type NavItem = { to: string; label: string; exact?: boolean };
const SUB_NAV: NavItem[] = [
  { to: "/credit", label: "نظرة عامة", exact: true },
  { to: "/credit/borrowers", label: "المقترضون" },
  { to: "/credit/loans", label: "القروض" },
  { to: "/credit/collateral", label: "الضمانات" },
  { to: "/credit/portfolio", label: "المحفظة" },
  { to: "/credit/watchlist", label: "Watch List" },
  { to: "/credit/early-warning", label: "الإنذار المبكر" },
  { to: "/credit/reports", label: "التقارير" },
];

function CreditLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">مخاطر الائتمان</h1>
        <p className="text-muted-foreground">Borrowers, loans, collateral, and portfolio-level risk metrics.</p>
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