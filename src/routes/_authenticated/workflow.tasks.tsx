import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { MODULE_LABEL, loadUnifiedTasks } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/workflow/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { data: tasks = [] } = useQuery({ queryKey: ["wf", "tasks"], queryFn: loadUnifiedTasks });
  const now = Date.now();
  return (
    <Card>
      <CardHeader><CardTitle>المهام عبر الوحدات</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الوحدة</TableHead>
              <TableHead>العنوان</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>مستوى الخطورة</TableHead>
              <TableHead>تاريخ الاستحقاق</TableHead>
              <TableHead>تم الإنشاء</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => {
              const overdue = t.due_date && new Date(t.due_date).getTime() < now && !["closed", "approved", "resolved"].includes(t.status);
              return (
                <TableRow key={`${t.source_module}-${t.id}`}>
                  <TableCell><Badge variant="outline">{MODULE_LABEL[t.source_module]}</Badge></TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                  <TableCell>{t.severity ?? "—"}</TableCell>
                  <TableCell className={overdue ? "text-red-600 font-medium" : ""}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                    {overdue && " (متأخّر)"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost"><Link to={t.action_url as never}>فتح</Link></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {tasks.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا توجد مهام.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
