import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { REF_TABLES } from "@/lib/reference-data";

export const Route = createFileRoute("/_authenticated/reference-data")({
  component: ReferenceDataLayout,
});

function ReferenceDataLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reference Data</h1>
        <p className="text-muted-foreground">
          Central management for all lookup and master data used across the platform. Replaces the
          previous Excel-based Master Data import workflow.
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b">
        <Link
          to="/reference-data"
          className={cn(
            "border-b-2 px-3 py-2 text-sm transition-colors",
            pathname === "/reference-data"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Overview
        </Link>
        {REF_TABLES.map((t) => {
          const to = `/reference-data/${t.key}` as const;
          const active = pathname === to;
          return (
            <Link
              key={t.key}
              to={to as never}
              className={cn(
                "border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
