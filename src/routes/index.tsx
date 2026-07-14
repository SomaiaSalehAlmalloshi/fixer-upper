import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Activity, Workflow, BarChart3, History } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <Shield className="h-5 w-5 text-primary" />
            Capital Compass
          </div>
          <div className="flex gap-2">
            <Link to="/auth">
              <Button variant="ghost">تسجيل الدخول</Button>
            </Link>
            <Link to="/dashboard">
              <Button>Open app</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="mb-4 inline-block rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Basel-aligned RWA platform
          </p>
          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
            Risk Weighted Assets, calculated and approved in one place.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Classify exposures, apply the right risk weights automatically, route them through
            approval, and see your capital picture in real time.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth">
              <Button size="lg">Get started</Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="outline">
                View dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            { icon: Shield, title: "Credit RWA", desc: "Sovereign, bank, corporate, retail and mortgage exposures." },
            { icon: TrendingUp, title: "Market RWA", desc: "Equity, interest-rate, FX and commodity risk." },
            { icon: Activity, title: "Operational RWA", desc: "Basic Indicator and Standardised approaches." },
            { icon: Workflow, title: "Approval workflow", desc: "Draft → Pending → Approved with audit trail." },
            { icon: History, title: "Calculation history", desc: "Every change snapshotted for audit." },
            { icon: BarChart3, title: "Reports & charts", desc: "RWA by category, status and over time." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
