import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dictionary")({
  component: DictionaryLayout,
});

type Nav = { to: string; label: string; exact?: boolean };
const SUB_NAV: Nav[] = [
  { to: "/dictionary", label: "قاموس البيانات", exact: true },
  { to: "/dictionary/validate", label: "التحقق من ملف" },
];

function DictionaryLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">قاموس البيانات وإدارة النماذج</h1>
        <p className="text-muted-foreground">
          المصدر المركزي الوحيد لتعريف كل حزم استيراد Excel — مرتبط ديناميكياً بمخطط قاعدة البيانات
          الحالية ويُعيد استخدام مركز الاستيراد القائم للتحقق من الصحة والاستيعاب.
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b">
        {SUB_NAV.map((n) => {
          const active = n.exact
            ? pathname === n.to
            : pathname === n.to || pathname.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to as never}
              className={cn(
                "border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
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
