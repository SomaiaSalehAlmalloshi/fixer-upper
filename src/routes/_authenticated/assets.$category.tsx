import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadAssets, loadRules, pickRiskWeight, fmtMoney, fmtPct, type Category, type Asset } from "@/lib/rwa";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Send } from "lucide-react";

const VALID = new Set(["credit", "market", "operational"]);

export const Route = createFileRoute("/_authenticated/assets/$category")({
  component: AssetsByCategory,
  beforeLoad: ({ params }) => {
    if (!VALID.has(params.category)) throw new Error("Unknown category");
  },
});

const TITLES: Record<Category, string> = {
  credit: "Credit RWA",
  market: "Market RWA",
  operational: "Operational RWA",
};

function AssetsByCategory() {
  const { category } = useParams({ from: "/_authenticated/assets/$category" }) as { category: Category };
  const qc = useQueryClient();
  const { user, canWrite } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: assets = [] } = useQuery({ queryKey: ["assets", category], queryFn: () => loadAssets(category) });
  const { data: rules = [] } = useQuery({ queryKey: ["rules"], queryFn: loadRules });

  const submit = useMutation({
    mutationFn: async (payload: {
      reference_code: string; name: string; asset_class: string;
      counterparty_type: string | null; rating: string | null;
      exposure_amount: number; risk_weight: number; currency: string; notes: string;
    }) => {
      const { error } = await supabase.from("rwa_assets").insert({
        ...payload,
        category,
        rwa_amount: payload.exposure_amount * payload.risk_weight,
        status: "draft",
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset created");
      qc.invalidateQueries({ queryKey: ["assets"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestApproval = useMutation({
    mutationFn: async (a: Asset) => {
      const { error } = await supabase.from("rwa_assets").update({ status: "pending" }).eq("id", a.id);
      if (error) throw error;
      await supabase.from("rwa_approvals").insert({ asset_id: a.id, action: "pending", actor_id: user!.id, comment: "Submitted for approval" });
    },
    onSuccess: () => {
      toast.success("Submitted for approval");
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = useMemo(
    () => assets.reduce((s, a) => s + Number(a.rwa_amount), 0),
    [assets],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">{TITLES[category]}</h1>
          <p className="text-muted-foreground">{assets.length} assets · Total RWA {fmtMoney(total)}</p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New asset</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New {category} asset</DialogTitle></DialogHeader>
              <AssetForm category={category} rules={rules} onSubmit={(v) => submit.mutate(v)} loading={submit.isPending} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>الأصول</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المرجع</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">التعرّض</TableHead>
                <TableHead className="text-right">وزن المخاطر</TableHead>
                <TableHead className="text-right">الأصول المرجّحة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.reference_code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.asset_class}</TableCell>
                  <TableCell className="text-right">{fmtMoney(Number(a.exposure_amount), a.currency)}</TableCell>
                  <TableCell className="text-right">{fmtPct(Number(a.risk_weight))}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(Number(a.rwa_amount), a.currency)}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    {a.status === "draft" && a.created_by === user?.id && (
                      <Button size="sm" variant="ghost" onClick={() => requestApproval.mutate(a)}>
                        <Send className="mr-1 h-3 w-3" /> Submit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {assets.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No assets yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-warning/20 text-warning-foreground",
    approved: "bg-success/20 text-success",
    rejected: "bg-destructive/20 text-destructive",
  };
  return <Badge className={map[status] || ""} variant="outline">{status}</Badge>;
}

function AssetForm({
  category,
  rules,
  onSubmit,
  loading,
}: {
  category: Category;
  rules: ReturnType<typeof Array<never>> extends never ? never : Awaited<ReturnType<typeof loadRules>>;
  onSubmit: (v: {
    reference_code: string; name: string; asset_class: string;
    counterparty_type: string | null; rating: string | null;
    exposure_amount: number; risk_weight: number; currency: string; notes: string;
  }) => void;
  loading: boolean;
}) {
  const categoryRules = rules.filter((r) => r.category === category && r.active);
  const classes = Array.from(new Set(categoryRules.map((r) => r.asset_class)));

  const [form, setForm] = useState({
    reference_code: `${category.toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    name: "",
    asset_class: classes[0] ?? "",
    counterparty_type: "",
    rating: "",
    exposure_amount: 0,
    currency: "USD",
    notes: "",
  });

  const rule = pickRiskWeight(rules, category, form.asset_class, form.counterparty_type || null, form.rating || null);
  const rw = rule ? Number(rule.risk_weight) : 1;
  const rwa = form.exposure_amount * rw;

  const counterpartyOpts = Array.from(new Set(categoryRules.filter((r) => r.asset_class === form.asset_class && r.counterparty_type).map((r) => r.counterparty_type!)));
  const ratingOpts = Array.from(new Set(categoryRules.filter((r) => r.asset_class === form.asset_class && r.rating).map((r) => r.rating!)));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          counterparty_type: form.counterparty_type || null,
          rating: form.rating || null,
          risk_weight: rw,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label>المرجع</Label><Input value={form.reference_code} onChange={(e) => setForm({ ...form, reference_code: e.target.value })} required /></div>
        <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
      </div>
      <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
      <div>
        <Label>Asset class</Label>
        <Select value={form.asset_class} onValueChange={(v) => setForm({ ...form, asset_class: v, counterparty_type: "", rating: "" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {counterpartyOpts.length > 0 && (
        <div>
          <Label>Counterparty type</Label>
          <Select value={form.counterparty_type} onValueChange={(v) => setForm({ ...form, counterparty_type: v })}>
            <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
            <SelectContent>{counterpartyOpts.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {ratingOpts.length > 0 && (
        <div>
          <Label>التصنيف</Label>
          <Select value={form.rating} onValueChange={(v) => setForm({ ...form, rating: v })}>
            <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
            <SelectContent>{ratingOpts.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div><Label>Exposure amount</Label><Input type="number" min={0} step="0.01" value={form.exposure_amount} onChange={(e) => setForm({ ...form, exposure_amount: Number(e.target.value) })} required /></div>
      <div><Label>ملاحظات</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

      <div className="rounded-md border bg-muted/50 p-3 text-sm">
        <div className="flex justify-between"><span>Risk weight (engine)</span><b>{fmtPct(rw)}</b></div>
        <div className="flex justify-between"><span>Computed RWA</span><b>{fmtMoney(rwa, form.currency)}</b></div>
        {rule?.description && <div className="mt-1 text-xs text-muted-foreground">{rule.description}</div>}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Saving…" : "Create asset"}</Button>
    </form>
  );
}
