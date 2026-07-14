import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadRules, fmtPct, type Category } from "@/lib/rwa";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/rules")({
  component: RulesPage,
});

function RulesPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: rules = [] } = useQuery({ queryKey: ["rules"], queryFn: loadRules });
  const [open, setOpen] = useState(false);

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("risk_weight_rules").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("risk_weight_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const create = useMutation({
    mutationFn: async (v: { category: Category; asset_class: string; counterparty_type: string; rating: string; risk_weight: number; description: string }) => {
      const { error } = await supabase.from("risk_weight_rules").insert({
        category: v.category,
        asset_class: v.asset_class,
        counterparty_type: v.counterparty_type || null,
        rating: v.rating || null,
        risk_weight: v.risk_weight,
        description: v.description,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rule added"); qc.invalidateQueries({ queryKey: ["rules"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Risk Weight Engine</h1>
          <p className="text-muted-foreground">Rules mapping asset class → risk weight. Used automatically when classifying assets.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New rule</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New risk weight rule</DialogTitle></DialogHeader>
              <RuleForm onSubmit={(v) => create.mutate(v)} loading={create.isPending} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(["credit", "market", "operational"] as Category[]).map((cat) => {
        const list = rules.filter((r) => r.category === cat);
        return (
          <Card key={cat}>
            <CardHeader><CardTitle className="capitalize">{cat} rules</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset class</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead className="text-right">Risk weight</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>نشط</TableHead>
                    {isAdmin && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.asset_class}</TableCell>
                      <TableCell>{r.counterparty_type ?? "—"}</TableCell>
                      <TableCell>{r.rating ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmtPct(Number(r.risk_weight))}</TableCell>
                      <TableCell className="text-muted-foreground">{r.description}</TableCell>
                      <TableCell>
                        <Switch checked={r.active} onCheckedChange={(v) => toggleActive.mutate({ id: r.id, active: v })} disabled={!isAdmin} />
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RuleForm({ onSubmit, loading }: { onSubmit: (v: { category: Category; asset_class: string; counterparty_type: string; rating: string; risk_weight: number; description: string }) => void; loading: boolean }) {
  const [f, setF] = useState({ category: "credit" as Category, asset_class: "", counterparty_type: "", rating: "", risk_weight: 1, description: "" });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <div>
        <Label>الفئة</Label>
        <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v as Category })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="market">Market</SelectItem>
            <SelectItem value="operational">المخاطر التشغيلية</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Asset class</Label><Input value={f.asset_class} onChange={(e) => setF({ ...f, asset_class: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Counterparty type</Label><Input value={f.counterparty_type} onChange={(e) => setF({ ...f, counterparty_type: e.target.value })} /></div>
        <div><Label>التصنيف</Label><Input value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })} /></div>
      </div>
      <div><Label>Risk weight (decimal, e.g. 0.20)</Label><Input type="number" step="0.0001" min={0} max={12.5} value={f.risk_weight} onChange={(e) => setF({ ...f, risk_weight: Number(e.target.value) })} required /></div>
      <div><Label>الوصف</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <Button type="submit" className="w-full" disabled={loading}>حفظ</Button>
    </form>
  );
}
