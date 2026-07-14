import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtMoney, fmtPct, type Asset } from "@/lib/rwa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { StatusBadge } from "./assets.$category";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: Approvals,
});

function Approvals() {
  const qc = useQueryClient();
  const { user, canApprove } = useAuth();

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rwa_assets").select("*").eq("status", "pending").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Asset[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ asset, decision, comment }: { asset: Asset; decision: "approved" | "rejected"; comment: string }) => {
      const { error } = await supabase.from("rwa_assets").update({ status: decision }).eq("id", asset.id);
      if (error) throw error;
      await supabase.from("rwa_approvals").insert({ asset_id: asset.id, action: decision, actor_id: user!.id, comment });
    },
    onSuccess: () => { toast.success("Recorded"); qc.invalidateQueries({ queryKey: ["pending-approvals"] }); qc.invalidateQueries({ queryKey: ["assets"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Approval Workflow</h1>
        <p className="text-muted-foreground">{pending.length} asset(s) awaiting decision {canApprove ? "" : "· (view-only — approver role required)"}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Pending assets</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المرجع</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead className="text-right">التعرّض</TableHead>
                <TableHead className="text-right">RW</TableHead>
                <TableHead className="text-right">الأصول المرجّحة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.reference_code}</TableCell>
                  <TableCell className="capitalize">{a.category}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell className="text-right">{fmtMoney(Number(a.exposure_amount), a.currency)}</TableCell>
                  <TableCell className="text-right">{fmtPct(Number(a.risk_weight))}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(Number(a.rwa_amount), a.currency)}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    {canApprove && <DecisionButtons onDecide={(decision, comment) => decide.mutate({ asset: a, decision, comment })} />}
                  </TableCell>
                </TableRow>
              ))}
              {pending.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Nothing pending.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DecisionButtons({ onDecide }: { onDecide: (d: "approved" | "rejected", c: string) => void }) {
  const [open, setOpen] = useState<null | "approved" | "rejected">(null);
  const [comment, setComment] = useState("");
  return (
    <div className="flex gap-2">
      <Dialog open={open === "approved"} onOpenChange={(o) => setOpen(o ? "approved" : null)}>
        <DialogTrigger asChild><Button size="sm" variant="outline"><Check className="mr-1 h-3 w-3" /> اعتماد</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve asset</DialogTitle></DialogHeader>
          <Textarea placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button onClick={() => { onDecide("approved", comment); setOpen(null); setComment(""); }}>Confirm approval</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={open === "rejected"} onOpenChange={(o) => setOpen(o ? "rejected" : null)}>
        <DialogTrigger asChild><Button size="sm" variant="outline" className="text-destructive"><X className="mr-1 h-3 w-3" /> رفض</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject asset</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason (required)" value={comment} onChange={(e) => setComment(e.target.value)} required />
          <Button variant="destructive" disabled={!comment.trim()} onClick={() => { onDecide("rejected", comment); setOpen(null); setComment(""); }}>Confirm rejection</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
