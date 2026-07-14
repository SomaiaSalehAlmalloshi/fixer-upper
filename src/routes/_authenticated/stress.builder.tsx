import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Save } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { listCashFlows, listHqla } from "@/lib/liquidity";
import { listPositions } from "@/lib/market";
import {
  DEFAULT_PARAMS, SEVERITY_LABEL, STRESS_TYPES, TYPE_LABEL,
  getScenario, runStress, saveRun, upsertScenario,
  type StressParams, type StressScenario, type StressSeverity, type StressType,
} from "@/lib/stress";

export const Route = createFileRoute("/_authenticated/stress/builder")({
  validateSearch: (s: Record<string, unknown>) => ({ from: typeof s.from === "string" ? s.from : undefined }),
  component: BuilderPage,
});

type Loan = Database["public"]["Tables"]["credit_loans"]["Row"];

const SEVERITIES: StressSeverity[] = ["mild", "moderate", "severe", "extreme"];

function BuilderPage() {
  const { from } = Route.useSearch();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { user } = useAuth();

  const [draft, setDraft] = useState<Partial<StressScenario>>({
    name: "", description: "", stress_type: "custom", severity: "moderate",
    parameters: DEFAULT_PARAMS as never, is_preset: false,
  });

  useEffect(() => {
    if (!from) return;
    getScenario(from).then((s) => setDraft({ ...s, id: undefined, name: s.name + " (copy)", is_preset: false }));
  }, [from]);

  const p = (draft.parameters ?? DEFAULT_PARAMS) as StressParams;
  const setParam = (k: keyof StressParams, v: number) => setDraft({ ...draft, parameters: { ...p, [k]: v } as never });

  const save = useMutation({
    mutationFn: async () => upsertScenario({ ...draft, created_by: user!.id }),
    onSuccess: (s) => { toast.success("Scenario saved"); qc.invalidateQueries({ queryKey: ["stress", "scenarios"] }); setDraft(s); },
    onError: (e: Error) => toast.error(e.message),
  });

  const run = useMutation({
    mutationFn: async () => {
      const saved = draft.id ? (draft as StressScenario) : await upsertScenario({ ...draft, created_by: user!.id });
      const [positions, hqla, flows, loansRes] = await Promise.all([
        listPositions(), listHqla(), listCashFlows(), supabase.from("credit_loans").select("*"),
      ]);
      if (loansRes.error) throw loansRes.error;
      const loans = (loansRes.data ?? []) as Loan[];
      const results = runStress(saved.parameters as StressParams, positions, loans, hqla, flows);
      return saveRun({
        scenario_id: saved.id,
        scenario_name: saved.name,
        stress_type: saved.stress_type,
        severity: saved.severity,
        parameters: saved.parameters,
        results: results as never,
        run_by: user!.id,
      });
    },
    onSuccess: (r) => { toast.success("Run complete"); qc.invalidateQueries({ queryKey: ["stress"] }); nav({ to: "/stress/$id", params: { id: r.id } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canRun = !!draft.name;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Scenario definition</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <F label="الاسم" className="md:col-span-2">
            <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </F>
          <F label="النوع">
            <Select value={draft.stress_type ?? "custom"} onValueChange={(v) => setDraft({ ...draft, stress_type: v as StressType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STRESS_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="مستوى الخطورة">
            <Select value={draft.severity ?? "moderate"} onValueChange={(v) => setDraft({ ...draft, severity: v as StressSeverity })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{SEVERITY_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="الوصف" className="md:col-span-3">
            <Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </F>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Shock parameters</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <NumF label="GDP shock (fraction)" step={0.01} value={p.gdp_shock ?? 0} onChange={(v) => setParam("gdp_shock", v)} />
          <NumF label="Equity shock (fraction)" step={0.01} value={p.equity_shock ?? 0} onChange={(v) => setParam("equity_shock", v)} />
          <NumF label="FX shock (fraction)" step={0.01} value={p.fx_shock ?? 0} onChange={(v) => setParam("fx_shock", v)} />
          <NumF label="Interest rate shock (bp)" step={1} value={p.ir_shock_bp ?? 0} onChange={(v) => setParam("ir_shock_bp", v)} />
          <NumF label="Commodity shock (fraction)" step={0.01} value={p.commodity_shock ?? 0} onChange={(v) => setParam("commodity_shock", v)} />
          <NumF label="Oil price shock (fraction)" step={0.01} value={p.oil_shock ?? 0} onChange={(v) => setParam("oil_shock", v)} />
          <NumF label="PD multiplier" step={0.1} value={p.pd_multiplier ?? 1} onChange={(v) => setParam("pd_multiplier", v)} />
          <NumF label="LGD uplift (fraction)" step={0.01} value={p.lgd_uplift ?? 0} onChange={(v) => setParam("lgd_uplift", v)} />
          <NumF label="Deposit run-off (fraction)" step={0.01} value={p.deposit_runoff ?? 0} onChange={(v) => setParam("deposit_runoff", v)} />
          <NumF label="HQLA extra haircut (fraction)" step={0.01} value={p.hqla_haircut ?? 0} onChange={(v) => setParam("hqla_haircut", v)} />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending || !canRun}><Save className="mr-2 h-4 w-4" /> حفظ</Button>
        <Button onClick={() => run.mutate()} disabled={run.isPending || !canRun}><Play className="mr-2 h-4 w-4" /> Run scenario</Button>
      </div>
    </div>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1 block text-xs uppercase text-muted-foreground">{label}</Label>{children}</div>;
}
function NumF({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return <F label={label}><Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></F>;
}
