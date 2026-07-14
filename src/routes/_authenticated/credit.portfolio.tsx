import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, fmtPct, loadPortfolio } from "@/lib/credit";

export const Route = createFileRoute("/_authenticated/credit/portfolio")({
  component: Page,
});

function Page() {
  const { data = [] } = useQuery({ queryKey: ["credit", "portfolio"], queryFn: loadPortfolio });
  const totals = data.reduce(
    (acc, r) => {
      acc.outstanding += Number(r.total_outstanding);
      acc.ead += Number(r.total_ead);
      acc.el += Number(r.total_el);
      return acc;
    },
    { outstanding: 0, ead: 0, el: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total Outstanding" value={fmtMoney(totals.outstanding)} />
        <Stat label="Total EAD" value={fmtMoney(totals.ead)} />
        <Stat label="Expected Loss" value={fmtMoney(totals.el)} accent />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Borrower</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead className="text-right">احتمالية التعثّر (PD)</TableHead>
                <TableHead className="text-right">القروض</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">التعرّض عند التعثّر (EAD)</TableHead>
                <TableHead className="text-right">EL</TableHead>
                <TableHead className="text-right">Max DPD</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.borrower_id ?? r.code}>
                  <TableCell><span className="font-mono text-xs">{r.code}</span> — {r.name}</TableCell>
                  <TableCell>{r.borrower_type}</TableCell>
                  <TableCell>{r.industry ?? "—"}</TableCell>
                  <TableCell>{r.credit_rating ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmtPct(r.pd)}</TableCell>
                  <TableCell className="text-right">{r.loan_count}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.total_outstanding)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.total_ead)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtMoney(r.total_el)}</TableCell>
                  <TableCell className="text-right">{r.max_dpd}</TableCell>
                  <TableCell>{r.has_default ? <Badge variant="destructive">Default</Badge> : null}</TableCell>
                </TableRow>
              ))}
              {!data.length && <TableRow><TableCell colSpan={11} className="py-6 text-center text-muted-foreground">No borrowers yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}