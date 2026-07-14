import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/stress")({
  component: StressLayout,
});

type Nav = { to: string; label: string; exact?: boolean };
const SUB_NAV: Nav[] = [
  { to: "/stress", label: "نظرة عامة", exact: true },
  { to: "/stress/builder", label: "Scenario Builder" },
  { to: "/stress/reports", label: "التقارير" },
];

function StressLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">اختبارات الضغط</h1>
        <p className="text-muted-foreground">
          Enterprise scenarios across market, credit and liquidity with AI-driven analysis.
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
