import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database } from "lucide-react";
import { REF_TABLES } from "@/lib/reference-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reference-data/")({
  component: ReferenceDataOverview,
});

function ReferenceDataOverview() {
  const { data: counts } = useQuery({
    queryKey: ["ref-data-counts"],
    queryFn: async () => {
      const entries = await Promise.all(
        REF_TABLES.map(async (t) => {
          const { count } = await supabase
            .from(t.table as never)
            .select("id", { count: "exact", head: true });
          return { key: t.key, count: count ?? 0 };
        }),
      );
      return Object.fromEntries(entries.map((e) => [e.key, e.count]));
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {REF_TABLES.map((t) => (
          <Card key={t.key} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-primary" />
                  {t.label}
                </CardTitle>
                <Badge variant="outline">{counts?.[t.key] ?? 0}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t.labelAr}</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3">
              <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
              <Button asChild size="sm" variant="outline">
                <Link to={`/reference-data/${t.key}` as never}>
                  Manage <ArrowLeft className="ms-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
