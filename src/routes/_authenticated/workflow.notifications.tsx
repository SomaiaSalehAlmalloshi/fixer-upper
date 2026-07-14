import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Check } from "lucide-react";
import {
  CHANNEL_LABEL, MODULE_LABEL, PRIORITY_COLOR, STATUS_COLOR,
  listNotifications, markAllRead, markRead,
} from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/workflow/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const uid = user!.id;
  const qc = useQueryClient();
  const { data: notifs = [] } = useQuery({ queryKey: ["wf", "notifs", uid], queryFn: () => listNotifications(uid, 200) });

  const readOne = useMutation({
    mutationFn: (id: string) => markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wf"] }),
  });
  const readAll = useMutation({
    mutationFn: () => markAllRead(uid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wf"] }); toast.success("All notifications marked read"); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notifications Inbox</CardTitle>
        <Button variant="outline" size="sm" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
          <Check className="mr-2 h-4 w-4" /> Mark all read
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Subject</TableHead><TableHead>الوحدة</TableHead><TableHead>Channel</TableHead>
            <TableHead>الأولوية</TableHead><TableHead>الحالة</TableHead><TableHead>الوقت</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {notifs.map((n) => (
              <TableRow key={n.id} className={n.read_at ? "opacity-60" : ""}>
                <TableCell>
                  <div className="font-medium">{n.subject}</div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                  {n.error && <div className="text-xs text-red-600">Error: {n.error}</div>}
                </TableCell>
                <TableCell><Badge variant="outline">{MODULE_LABEL[n.source_module]}</Badge></TableCell>
                <TableCell>{CHANNEL_LABEL[n.channel]}</TableCell>
                <TableCell><span className={`inline-flex rounded px-2 py-0.5 text-xs ${PRIORITY_COLOR[n.priority]}`}>{n.priority}</span></TableCell>
                <TableCell><span className={`inline-flex rounded px-2 py-0.5 text-xs ${STATUS_COLOR[n.status]}`}>{n.status}</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {!n.read_at && <Button size="sm" variant="ghost" onClick={() => readOne.mutate(n.id)}>Read</Button>}
                </TableCell>
              </TableRow>
            ))}
            {notifs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No notifications.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
