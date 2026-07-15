/**
 * Reusable full-CRUD table for Reference Data (Master Data) management.
 *
 * Features:
 *  - Search across all text columns
 *  - Column sorting (asc/desc, click header)
 *  - Filtering by active status
 *  - Pagination (client-side, 10/25/50 per page)
 *  - Create / Edit dialog with validation + duplicate prevention
 *  - Delete with usage-in-use check before allowing deletion
 *  - Success toast / error toast
 *
 * Replaces the old Master Data Excel import workflow.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RefColumn, RefTableSpec } from "@/lib/reference-data";

type Row = Record<string, unknown>;

interface Props {
  spec: RefTableSpec;
}

export function ReferenceDataTable({ spec }: Props) {
  const qc = useQueryClient();
  const { user, canWrite } = useAuth();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortKey, setSortKey] = useState<string>(spec.naturalKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null);

  const queryKey = ["ref-data", spec.table];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(spec.table as never)
        .select("*")
        .order(spec.naturalKey, { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const searchableCols = spec.columns.filter((c) => c.type === "text").map((c) => c.key);

  const filtered = useMemo(() => {
    let out = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) =>
        searchableCols.some((c) => String(r[c] ?? "").toLowerCase().includes(q)),
      );
    }
    if (activeFilter !== "all") {
      const want = activeFilter === "active";
      out = out.filter((r) => Boolean(r.active) === want);
    }
    const sorted = [...out].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return sorted;
  }, [rows, search, activeFilter, sortKey, sortDir, searchableCols]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const tableCols = spec.columns.filter((c) => !c.hideInTable);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openCreate() {
    setEditing(null);
    const defaults: Record<string, unknown> = {};
    for (const c of spec.columns) {
      if (c.key === "active") defaults[c.key] = true;
      else if (c.type === "number") defaults[c.key] = c.min ?? 0;
      else defaults[c.key] = "";
    }
    setForm(defaults);
    setFormErrors({});
    setDialogOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    const values: Record<string, unknown> = {};
    for (const c of spec.columns) {
      values[c.key] = row[c.key] ?? (c.type === "boolean" ? false : "");
    }
    setForm(values);
    setFormErrors({});
    setDialogOpen(true);
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const c of spec.columns) {
      const v = form[c.key];
      if (c.required) {
        if (c.type === "boolean") continue;
        if (v === "" || v === null || v === undefined) {
          errs[c.key] = `${c.label} is required`;
        }
      }
      if (c.type === "number" && v !== "" && v != null) {
        const n = Number(v);
        if (Number.isNaN(n)) errs[c.key] = `${c.label} must be a number`;
        else {
          if (c.min !== undefined && n < c.min) errs[c.key] = `${c.label} must be ≥ ${c.min}`;
          if (c.max !== undefined && n > c.max) errs[c.key] = `${c.label} must be ≤ ${c.max}`;
        }
      }
      if (c.type === "select" && v && c.options && !c.options.includes(String(v))) {
        errs[c.key] = `${c.label} is invalid`;
      }
    }
    return errs;
  }

  const save = useMutation({
    mutationFn: async () => {
      const errs = validate();
      if (Object.keys(errs).length) {
        setFormErrors(errs);
        throw new Error("Please fix the highlighted fields.");
      }

      const payload: Record<string, unknown> = {};
      for (const c of spec.columns) {
        let v = form[c.key];
        if (c.type === "number") {
          v = v === "" || v == null ? null : Number(v);
        } else if (c.type === "boolean") {
          v = Boolean(v);
        } else {
          v = v === "" ? null : v;
        }
        payload[c.key] = v;
      }

      // Duplicate prevention on natural key
      const nk = String(payload[spec.naturalKey] ?? "").trim();
      if (nk) {
        let dupQuery = supabase.from(spec.table as never).select("id").eq(spec.naturalKey, nk);
        if (editing) dupQuery = dupQuery.neq("id", String(editing.id));
        const { data: dup } = await dupQuery.maybeSingle();
        if (dup) {
          setFormErrors({ [spec.naturalKey]: `A record with ${spec.naturalKey} "${nk}" already exists.` });
          throw new Error(`Duplicate ${spec.naturalKey}: "${nk}"`);
        }
      }

      if (editing) {
        const { error } = await supabase
          .from(spec.table as never)
          .update(payload as never)
          .eq("id", String(editing.id));
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from(spec.table as never).insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Record updated" : "Record created");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => {
      if (!e.message.startsWith("Duplicate") && !e.message.startsWith("Please fix")) {
        toast.error(e.message);
      } else if (e.message.startsWith("Duplicate")) {
        toast.error(e.message);
      }
    },
  });

  async function checkUsage(row: Row): Promise<string | null> {
    if (!spec.usageChecks || spec.usageChecks.length === 0) return null;
    const nk = String(row[spec.naturalKey] ?? "");
    for (const uc of spec.usageChecks) {
      const { count, error } = await supabase
        .from(uc.table as never)
        .select("id", { count: "exact", head: true })
        .eq(uc.column, nk);
      if (error) continue;
      if ((count ?? 0) > 0) {
        return `This ${spec.label.toLowerCase().replace(/s$/, "")} is referenced by ${count} ${uc.label.toLowerCase()} record(s). Please remove or reassign those references before deleting.`;
      }
    }
    return null;
  }

  const remove = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const blocked = await checkUsage(deleteTarget);
      if (blocked) {
        setDeleteBlocked(blocked);
        throw new Error(blocked);
      }
      const { error } = await supabase
        .from(spec.table as never)
        .delete()
        .eq("id", String(deleteTarget.id));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Record deleted");
      setDeleteTarget(null);
      setDeleteBlocked(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => {
      if (!deleteBlocked) toast.error(e.message);
    },
  });

  function startDelete(row: Row) {
    setDeleteTarget(row);
    setDeleteBlocked(null);
    remove.reset();
  }

  function renderCell(row: Row, col: RefColumn) {
    const v = row[col.key];
    if (col.type === "boolean") {
      return <Badge variant={v ? "default" : "secondary"}>{v ? "Active" : "Inactive"}</Badge>;
    }
    if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
    return String(v);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-64 pl-8"
            />
          </div>
          <Select
            value={activeFilter}
            onValueChange={(v) => {
              setActiveFilter(v as typeof activeFilter);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add record
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {tableCols.map((c) => (
                <TableHead key={c.key} style={c.width ? { width: c.width } : undefined}>
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 text-left font-medium hover:text-foreground"
                  >
                    {c.label}
                    {sortKey === c.key &&
                      (sortDir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      ))}
                  </button>
                </TableHead>
              ))}
              {canWrite && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={tableCols.length + 1} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableCols.length + 1} className="text-center text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row) => (
                <TableRow key={String(row.id)}>
                  {tableCols.map((c) => (
                    <TableCell key={c.key} className="align-middle">
                      {renderCell(row, c)}
                    </TableCell>
                  ))}
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => startDelete(row)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(0);
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">
            {filtered.length} record(s)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-muted-foreground">
            Page {safePage + 1} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} {spec.label.toLowerCase().replace(/s$/, "")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {spec.columns.map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <Label htmlFor={c.key}>
                    {c.label}
                    {c.required && <span className="text-destructive"> *</span>}
                  </Label>
                  {c.type === "boolean" ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        id={c.key}
                        checked={Boolean(form[c.key])}
                        onCheckedChange={(v) => setForm({ ...form, [c.key]: v })}
                      />
                      <span className="text-sm text-muted-foreground">
                        {form[c.key] ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ) : c.type === "select" ? (
                    <Select
                      value={String(form[c.key] ?? "")}
                      onValueChange={(v) => setForm({ ...form, [c.key]: v })}
                    >
                      <SelectTrigger id={c.key}>
                        <SelectValue placeholder={c.placeholder ?? "Select…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {c.options?.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : c.type === "number" ? (
                    <Input
                      id={c.key}
                      type="number"
                      step={c.step}
                      min={c.min}
                      max={c.max}
                      placeholder={c.placeholder}
                      value={form[c.key] === null || form[c.key] === undefined ? "" : String(form[c.key])}
                      onChange={(e) =>
                        setForm({ ...form, [c.key]: e.target.value === "" ? "" : Number(e.target.value) })
                      }
                    />
                  ) : c.key === "notes" || c.key === "description" || c.key === "address" ? (
                    <Textarea
                      id={c.key}
                      placeholder={c.placeholder}
                      value={String(form[c.key] ?? "")}
                      onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                    />
                  ) : (
                    <Input
                      id={c.key}
                      placeholder={c.placeholder}
                      value={String(form[c.key] ?? "")}
                      onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                    />
                  )}
                  {formErrors[c.key] && (
                    <p className="text-xs text-destructive">{formErrors[c.key]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteBlocked(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlocked ? (
                <span className="text-destructive">{deleteBlocked}</span>
              ) : (
                <>
                  Are you sure you want to delete{" "}
                  <strong>{String(deleteTarget?.[spec.displayColumn] ?? deleteTarget?.[spec.naturalKey])}</strong>? This
                  action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {deleteBlocked ? (
              <AlertDialogAction
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteBlocked(null);
                }}
              >
                OK
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  remove.mutate();
                }}
                disabled={remove.isPending}
              >
                {remove.isPending ? "Checking…" : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
