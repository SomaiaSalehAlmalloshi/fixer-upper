import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Shield,
  ShieldAlert,
  LayoutDashboard,
  Coins,
  TrendingUp,
  Activity,
  Sliders,
  Workflow,
  History,
  FileBarChart,
  LogOut,
  Banknote,
  LineChart,
  Droplets,
  Zap,
  ShieldCheck,
  FileStack,
  Sparkles,
  Upload,

  Workflow as WorkflowIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { NotificationBell } from "@/components/workflow/NotificationBell";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

type NavItem = { match: string; label: string; icon: React.ElementType; render: (children: ReactNode) => ReactNode };

const NAV: NavItem[] = [
  { match: "/dashboard", label: t("nav_dashboard"), icon: LayoutDashboard, render: (c) => <Link to="/dashboard">{c}</Link> },
  { match: "/credit", label: t("nav_credit"), icon: Banknote, render: (c) => <Link to="/credit">{c}</Link> },
  { match: "/market", label: t("nav_market"), icon: LineChart, render: (c) => <Link to="/market">{c}</Link> },
  { match: "/operational", label: t("nav_operational"), icon: ShieldAlert, render: (c) => <Link to="/operational">{c}</Link> },
  { match: "/liquidity", label: t("nav_liquidity"), icon: Droplets, render: (c) => <Link to="/liquidity">{c}</Link> },
  { match: "/stress", label: t("nav_stress"), icon: Zap, render: (c) => <Link to="/stress">{c}</Link> },
  { match: "/compliance", label: t("nav_compliance"), icon: ShieldCheck, render: (c) => <Link to="/compliance">{c}</Link> },
  { match: "/reporting", label: t("nav_reporting"), icon: FileStack, render: (c) => <Link to="/reporting">{c}</Link> },
  { match: "/ai", label: t("nav_ai"), icon: Sparkles, render: (c) => <Link to="/ai">{c}</Link> },
  { match: "/imports", label: t("nav_imports"), icon: Upload, render: (c) => <Link to="/imports">{c}</Link> },
  { match: "/dictionary", label: "قاموس البيانات", icon: FileStack, render: (c) => <Link to="/dictionary">{c}</Link> },
  { match: "/workflow", label: t("nav_workflow"), icon: WorkflowIcon, render: (c) => <Link to="/workflow">{c}</Link> },
  { match: "/assets/credit", label: t("nav_rwa_credit"), icon: Coins, render: (c) => <Link to="/assets/$category" params={{ category: "credit" }}>{c}</Link> },
  { match: "/assets/market", label: t("nav_rwa_market"), icon: TrendingUp, render: (c) => <Link to="/assets/$category" params={{ category: "market" }}>{c}</Link> },
  { match: "/assets/operational", label: t("nav_rwa_operational"), icon: Activity, render: (c) => <Link to="/assets/$category" params={{ category: "operational" }}>{c}</Link> },
  { match: "/rules", label: t("nav_rules"), icon: Sliders, render: (c) => <Link to="/rules">{c}</Link> },
  { match: "/approvals", label: t("nav_approvals"), icon: Workflow, render: (c) => <Link to="/approvals">{c}</Link> },
  { match: "/history", label: t("nav_history"), icon: History, render: (c) => <Link to="/history">{c}</Link> },
  { match: "/reports", label: t("nav_reports"), icon: FileBarChart, render: (c) => <Link to="/reports">{c}</Link> },
];

function AuthedLayout() {
  const navigate = useNavigate();
  const { user, loading, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("loading")}</div>;
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success(t("signed_out"));
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-4 font-semibold">
          <Shield className="h-5 w-5 text-sidebar-primary" />
          {t("app_name")}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = pathname === item.match || pathname.startsWith(item.match + "/");
            const cls = cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            );
            const inner = (
              <span className={cls}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
            );
            return <div key={item.match}>{item.render(inner)}</div>;
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-3 text-xs text-sidebar-foreground/60">
            <div className="truncate">{user.email}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {roles.map((r) => (
                <span key={r} className="rounded-sm bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase">
                  {r}
                </span>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="ms-2 h-4 w-4" /> {t("sign_out")}
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="flex items-center justify-end gap-2 border-b px-6 py-2">
          <NotificationBell userId={user.id} />
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
