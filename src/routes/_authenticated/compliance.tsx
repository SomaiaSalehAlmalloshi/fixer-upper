import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/compliance")({
  component: ComplianceLayout,
});

type Nav = { to: string; label: string; exact?: boolean };
const SUB_NAV: Nav[] = [
  { to: "/compliance", label: "نظرة عامة", exact: true },
  { to: "/compliance/monitoring", label: "Monitoring" },
  { to: "/compliance/violations", label: "Violations" },
  { to: "/compliance/tasks", label: "المهام" },
  { to: "/compliance/approvals", label: "الاعتمادات" },
  { to: "/compliance/rules", label: "القواعد" },
  { to: "/compliance/audit", label: "المراجعة" },
  { to: "/compliance/reports", label: "التقارير" },
];

function ComplianceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compliance Center</h1>
        <p className="text-muted-foreground">
          Basel III monitoring, violations, remediation workflow and audit trail. Basel IV framework ready.
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
