import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import {
  CHANNEL_LABEL, MODULE_LABEL, listPreferences, upsertPreference,
  type Channel, type Module,
} from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/workflow/preferences")({
  component: PreferencesPage,
});

const CHANNELS: Channel[] = ["in_app", "email", "sms", "push"];
const MODULES: Module[] = ["compliance", "credit", "market", "operational", "liquidity", "stress", "rwa", "reporting", "system"];

function PreferencesPage() {
  const { user } = useAuth();
  const uid = user!.id;
  const qc = useQueryClient();
  const { data: prefs = [] } = useQuery({ queryKey: ["wf", "prefs", uid], queryFn: () => listPreferences(uid) });

  const toggle = useMutation({
    mutationFn: async ({ module, channel, enabled }: { module: Module; channel: Channel; enabled: boolean }) => {
      await upsertPreference({ user_id: uid, source_module: module, channel, enabled });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wf", "prefs"] }); toast.success("تم حفظ التفضيل"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isEnabled = (m: Module, c: Channel) => {
    const row = prefs.find((p) => p.source_module === m && p.channel === c);
    return row ? row.enabled : true; // default enabled
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>تفضيلات الإشعارات</CardTitle>
        <p className="text-sm text-muted-foreground">
          Control which channels are used for each module. Email and SMS also require the corresponding integrations to be configured.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>الوحدة</TableHead>
            {CHANNELS.map((c) => <TableHead key={c} className="text-center">{CHANNEL_LABEL[c]}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {MODULES.map((m) => (
              <TableRow key={m}>
                <TableCell className="font-medium">{MODULE_LABEL[m]}</TableCell>
                {CHANNELS.map((c) => (
                  <TableCell key={c} className="text-center">
                    <Switch
                      checked={isEnabled(m, c)}
                      onCheckedChange={(v) => toggle.mutate({ module: m, channel: c, enabled: v })}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
