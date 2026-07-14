import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operational")({
  component: OperationalLayout,
});

type Nav = { to: string; label: string; exact?: boolean };
const SUB_NAV: Nav[] = [
  { to: "/operational", label: "نظرة عامة", exact: true },
  { to: "/operational/incidents", label: "Incident Register" },
  { to: "/operational/losses", label: "أحداث الخسارة" },
  { to: "/operational/fraud", label: "الاحتيال" },
  { to: "/operational/cyber", label: "الأمن السيبراني" },
  { to: "/operational/bcp", label: "Business Continuity" },
  { to: "/operational/kris", label: "مؤشرات المخاطر الرئيسية" },
  { to: "/operational/rcsa", label: "التقييم الذاتي للمخاطر والضوابط (RCSA)" },
  { to: "/operational/register", label: "سجل المخاطر" },
  { to: "/operational/reports", label: "التقارير" },
];

function OperationalLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">المخاطر التشغيلية</h1>
        <p className="text-muted-foreground">
          Incidents, loss events, fraud, cyber, business continuity, KRIs, RCSA and the enterprise risk register.
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
