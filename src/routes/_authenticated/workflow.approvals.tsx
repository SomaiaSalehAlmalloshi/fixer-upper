import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/workflow/approvals")({
  component: ApprovalsPage,
});

async function loadPending() {
  const [ct, ra] = await Promise.all([
    supabase.from("compliance_tasks").select("id,title,priority,due_date,assignee,status").eq("status", "pending_approval"),
    supabase.from("rwa_approvals").select("id,asset_id,action,actor_id,comment,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  return { compliance: ct.data ?? [], rwa: ra.data ?? [] };
}

function ApprovalsPage() {
  const { data } = useQuery({ queryKey: ["wf", "approvals"], queryFn: loadPending });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Compliance — Pending Approval</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>الأولوية</TableHead><TableHead>Due</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(data?.compliance ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell><Badge variant="secondary">P{t.priority}</Badge></TableCell>
                  <TableCell>{t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell><Button asChild size="sm" variant="ghost"><Link to={`/compliance/tasks/${t.id}` as never}>Review</Link></Button></TableCell>
                </TableRow>
              ))}
              {(data?.compliance ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nothing awaiting compliance approval.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>RWA — Recent Approval Actions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>الأصل</TableHead><TableHead>Action</TableHead><TableHead>الفاعل</TableHead><TableHead>تعليق</TableHead><TableHead>الوقت</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.rwa ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.asset_id.slice(0, 8)}</TableCell>
                  <TableCell><Badge>{a.action}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{a.actor_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.comment ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(data?.rwa ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No RWA approval activity.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
