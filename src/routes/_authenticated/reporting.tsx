import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reporting")({
  component: ReportingLayout,
});

const SUB_NAV = [
  { to: "/reporting", label: "Catalog", exact: true },
  { to: "/reporting/schedules", label: "Schedules" },
  { to: "/reporting/history", label: "السجل" },
];

function ReportingLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reporting Center</h1>
        <p className="text-muted-foreground">
          Regulator-ready and executive reports across every risk domain. Export to PDF, Excel, CSV or Word — schedule and distribute automatically.
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
