import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiUrl } from "@/lib/api";

const sevStyle = {
  low: "bg-sky-400/20 text-sky-200",
  medium: "bg-[#F59E0B]/20 text-[#F59E0B]",
  high: "bg-[#EF4444]/20 text-[#EF4444]",
};

const statusStyle = {
  open: "bg-white/10 text-white",
  ignored: "bg-white/5 text-gray-300",
  resolved: "bg-[#22C55E]/20 text-[#22C55E]",
};

export default function QualityPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("all");
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteDialog, setNoteDialog] = useState({
    id: null,
    nextStatus: null,
    ruleId: "",
    subjectLabel: "",
    note: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(apiUrl("/quality/anomalies"), {
        withCredentials: true,
        params: {
          status: status === "all" ? undefined : status,
          severity: severity === "all" ? undefined : severity,
          limit: 300,
        },
      });
      setAnomalies(res.data.anomalies || []);
    } catch (e) {
      toast.error("Failed to load anomalies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, severity]);

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await axios.post(apiUrl("/quality/anomalies/run"), {}, { withCredentials: true });
      toast.success(`Scan complete (${res.data.upserted || 0} upserted)`);
      await load();
    } catch {
      toast.error("Anomaly scan failed");
      setLoading(false);
    }
  };

  const updateStatusWithNote = async (id, nextStatus, note) => {
    try {
      await axios.post(
        apiUrl(`/quality/anomalies/${id}/status`),
        { status: nextStatus, resolution_note: (note || "").trim() ? (note || "").trim() : null },
        { withCredentials: true }
      );
      setAnomalies((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: nextStatus, resolution_note: (note || "").trim() ? (note || "").trim() : a.resolution_note }
            : a
        )
      );
      toast.success("Updated anomaly");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const counts = useMemo(() => {
    const c = { open: 0, ignored: 0, resolved: 0 };
    for (const a of anomalies || []) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [anomalies]);

  const canFixInEvidence = (a) => {
    const ruleId = a?.rule_id || "";
    return ruleId.startsWith("provenance.missing.") || ruleId.startsWith("evidence.");
  };

  const evidenceActionLabel = (a) => {
    const ruleId = a?.rule_id || "";
    if (ruleId.startsWith("provenance.missing.")) return "Provenance";
    return "Evidence";
  };

  const openEvidence = (a) => {
    const d = a?.details || {};
    const params = new URLSearchParams();
    if (d.entity_type) params.set("entity_type", String(d.entity_type));
    if (d.entity_id) params.set("entity_id", String(d.entity_id));
    if (d.field_key) params.set("field_key", String(d.field_key));
    if (d.field_label) params.set("field_label", String(d.field_label));
    if (d.field_value != null) params.set("value", String(d.field_value));
    if (d.unit != null) params.set("unit", String(d.unit));

    const ruleId = a?.rule_id || "";
    const anchor = ruleId.startsWith("provenance.missing.") ? "#provenance" : ruleId.startsWith("evidence.") ? "#upload" : "";
    if (params.toString()) navigate(`/dashboard/evidence?${params.toString()}${anchor}`);
    else navigate(`/dashboard/evidence${anchor}`);

    if (ruleId.startsWith("provenance.missing.")) {
      const field = d.field_label || d.field_key || "field";
      const entityId = d.entity_id || d.entityId || "";
      toast.info(`Evidence: add field provenance for ${field}${entityId ? ` (entity ${entityId})` : ""}.`);
      return;
    }

    if (ruleId.startsWith("evidence.")) {
      toast.info("Evidence: upload/attach supporting docs, then re-run the scan.");
    }
  };

  const openResolveIgnoreDialog = (a, nextStatus) => {
    setNoteDialog({
      id: a?.id || null,
      nextStatus,
      ruleId: a?.rule_id || "",
      subjectLabel: a?.subject_label || a?.subject_id || "",
      note: "",
    });
    setNoteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white ml-64 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight">Quality</h1>
          <p className="text-sm sm:text-base text-gray-400 mt-2">
            Deterministic anomaly detection and fix queue (no LLM).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-[#121212] border-white/10 p-4 lg:col-span-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Filters</div>
                <Button
                  className="h-8 px-3 bg-[#22C55E] hover:bg-[#16A34A] text-black"
                  onClick={runScan}
                  disabled={loading}
                >
                  Run scan
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Status</div>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="bg-[#0A0A0A] border-white/10">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-white/10">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="ignored">Ignored</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Severity</div>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger className="bg-[#0A0A0A] border-white/10">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-white/10">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                <Badge className={`${statusStyle.open} border-0`}>Open: {counts.open}</Badge>
                <Badge className={`${statusStyle.ignored} border-0`}>Ignored: {counts.ignored}</Badge>
                <Badge className={`${statusStyle.resolved} border-0`}>Resolved: {counts.resolved}</Badge>
              </div>

              <div className="text-xs text-gray-500">
                Tip: Open anomalies are upserted deterministically, so running scans is safe.
              </div>
            </div>
          </Card>

          <Card className="bg-[#121212] border-white/10 p-4 lg:col-span-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Fix Queue</div>

            <div className="rounded-md border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-gray-400">Rule</TableHead>
                    <TableHead className="text-gray-400">Severity</TableHead>
                    <TableHead className="text-gray-400">Subject</TableHead>
                    <TableHead className="text-gray-400">Message</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(anomalies || []).length === 0 ? (
                    <TableRow className="border-white/10">
                      <TableCell className="text-gray-500" colSpan={6}>
                        No anomalies found for the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    anomalies.map((a) => (
                      <TableRow key={a.id} className="border-white/10">
                        <TableCell className="font-mono text-xs text-gray-300">{a.rule_id}</TableCell>
                        <TableCell>
                          <Badge className={`${sevStyle[a.severity] || "bg-white/10 text-white"} border-0`}>
                            {a.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-200">
                          <div className="truncate max-w-[180px]">{a.subject_label || a.subject_id}</div>
                          <div className="text-[10px] text-gray-500 font-mono">{a.subject_type}</div>
                        </TableCell>
                        <TableCell className="text-xs text-gray-200 max-w-[360px] whitespace-normal break-words">
                          <div>{a.message}</div>
                          {a.fix_hint ? <div className="text-[10px] text-gray-500 mt-1">{a.fix_hint}</div> : null}
                          {a.resolution_note ? (
                            <div className="text-[10px] text-gray-400 mt-1">
                              Note: <span className="text-gray-300">{a.resolution_note}</span>
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusStyle[a.status] || "bg-white/10 text-white"} border-0`}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canFixInEvidence(a) ? (
                              <Button className="h-8 px-3" variant="outline" onClick={() => openEvidence(a)} disabled={loading}>
                                {evidenceActionLabel(a)}
                              </Button>
                            ) : null}
                            <Button
                              className="h-8 px-3"
                              variant="secondary"
                              onClick={() => openResolveIgnoreDialog(a, "ignored")}
                              disabled={loading || a.status === "ignored"}
                            >
                              Ignore
                            </Button>
                            <Button
                              className="h-8 px-3 bg-[#22C55E] hover:bg-[#16A34A] text-black"
                              onClick={() => openResolveIgnoreDialog(a, "resolved")}
                              disabled={loading || a.status === "resolved"}
                            >
                              Resolve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="bg-[#121212] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {noteDialog.nextStatus === "resolved" ? "Resolve anomaly" : "Ignore anomaly"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Add an optional note for auditability. This won’t be overwritten by future scans.
            </DialogDescription>
          </DialogHeader>

          <div className="text-xs text-gray-400">
            <div className="font-mono text-[10px] text-gray-500">{noteDialog.ruleId}</div>
            <div className="mt-1 text-gray-200">{noteDialog.subjectLabel}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Note (optional)</div>
            <Textarea
              className="bg-[#0A0A0A] border-white/10 text-white placeholder:text-gray-600"
              placeholder="Why are you resolving/ignoring this anomaly?"
              value={noteDialog.note}
              onChange={(e) => setNoteDialog((prev) => ({ ...prev, note: e.target.value }))}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setNoteDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              className={noteDialog.nextStatus === "resolved" ? "bg-[#22C55E] hover:bg-[#16A34A] text-black" : ""}
              variant={noteDialog.nextStatus === "resolved" ? "default" : "outline"}
              onClick={async () => {
                if (!noteDialog.id || !noteDialog.nextStatus) return;
                setNoteDialogOpen(false);
                await updateStatusWithNote(noteDialog.id, noteDialog.nextStatus, noteDialog.note);
              }}
              disabled={loading}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
