import { createFileRoute, useParams } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceDataTable } from "@/components/reference-data/ReferenceDataTable";
import { getRefTable } from "@/lib/reference-data";

export const Route = createFileRoute("/_authenticated/reference-data/$tableKey")({
  component: RefTablePage,
});

function RefTablePage() {
  const { tableKey } = useParams({ from: "/_authenticated/reference-data/$tableKey" });
  const spec = getRefTable(tableKey);

  if (!spec) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Unknown reference table: {tableKey}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{spec.label}</span>
          <span className="text-sm font-normal text-muted-foreground">{spec.labelAr}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{spec.description}</p>
      </CardHeader>
      <CardContent>
        <ReferenceDataTable spec={spec} />
      </CardContent>
    </Card>
  );
}
