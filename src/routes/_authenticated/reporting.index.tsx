import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { AUDIENCE_LABEL, REPORTS, type Audience } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/reporting/")({
  component: Catalog,
});

const AUDIENCE_ORDER: Audience[] = ["capital", "liquidity", "risk", "compliance", "audit", "management", "board", "central_bank"];

function Catalog() {
  const grouped = useMemo(() => {
    const map = new Map<Audience, typeof REPORTS>();
    for (const a of AUDIENCE_ORDER) map.set(a, []);
    for (const r of REPORTS) map.get(r.audience)!.push(r);
    return map;
  }, []);

  return (
    <div className="space-y-6">
      {AUDIENCE_ORDER.map((aud) => {
        const items = grouped.get(aud) ?? [];
        if (!items.length) return null;
        return (
          <section key={aud} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{AUDIENCE_LABEL[aud]}</h2>
              <Badge variant="outline">{items.length}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <Card key={r.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> {r.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                    <Button asChild size="sm"><Link to="/reporting/$key" params={{ key: r.key }}>فتح</Link></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
