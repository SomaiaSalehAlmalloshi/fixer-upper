import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { listNotifications, markRead, unreadCount, MODULE_LABEL } from "@/lib/workflow";

export function NotificationBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: unread = 0 } = useQuery({
    queryKey: ["wf", "unread", userId],
    queryFn: () => unreadCount(userId),
    refetchInterval: 30_000,
  });
  const { data: notifs = [] } = useQuery({
    queryKey: ["wf", "notifs", userId, "recent"],
    queryFn: () => listNotifications(userId, 8),
    refetchInterval: 30_000,
  });

  // Realtime subscription for new notifications
  useEffect(() => {
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["wf"] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold">الإشعارات</span>
          <Link to="/workflow/notifications" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>}
          {notifs.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`block w-full border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-muted/50 ${n.read_at ? "opacity-60" : ""}`}
              onClick={async () => {
                if (!n.read_at) { await markRead(n.id); qc.invalidateQueries({ queryKey: ["wf"] }); }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{n.subject}</div>
                <Badge variant="outline" className="text-[10px]">{MODULE_LABEL[n.source_module]}</Badge>
              </div>
              {n.body && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
              <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
