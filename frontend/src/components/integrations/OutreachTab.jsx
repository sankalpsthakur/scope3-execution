import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { outreachClient } from "@/lib/outreachClient";
import { integrationsClient } from "@/lib/integrationsClient";

const statusStyle = {
  invited: "bg-white/5 text-gray-300",
  evidence_requested: "bg-[#F59E0B]/20 text-[#F59E0B]",
  evidence_received: "bg-[#0EA5E9]/20 text-[#0EA5E9]",
  verified: "bg-[#22C55E]/20 text-[#22C55E]",
};

const EVIDENCE_TYPES = [
  "PCF",
  "Supplier ESG report",
  "ISO 14064 statement",
  "Electricity / energy bills",
  "Freight lane data",
  "Waste + recycling data",
];

function formatChannel(channel) {
  if (!channel) return "—";
  if (channel.type === "connector") return channel.label || channel.connector_id;
  if (channel.type === "email") return channel.label || "Email";
  return channel.label || channel.type || "—";
}

export function OutreachTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [catalog, setCatalog] = useState([]);

  const [inviteForm, setInviteForm] = useState({
    supplier_name: "",
    supplier_email: "",
    channel_id: "email_sftp",
  });

  const [evidenceForm, setEvidenceForm] = useState({
    type: "PCF",
    due_date: "",
    message: "Please upload the requested evidence (PDF/CSV) and include methodology notes.",
  });

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);
  const latestRequest = useMemo(() => (selected?.evidence_requests || [])[0] || null, [selected]);

  const vendorPortalConnectors = useMemo(() => {
    const vps = (catalog || []).filter((c) => (c.category || "").toLowerCase().includes("vendor"));
    const fallback = (catalog || []).filter((c) => c.id === "email_sftp");
    return [...vps, ...fallback];
  }, [catalog]);

  const load = async () => {
    setLoading(true);
    try {
      const [o, cat] = await Promise.all([outreachClient.list(), integrationsClient.getCatalog()]);
      setRows(o.outreach || []);
      setCatalog(cat.connectors || []);
      if (!selectedId && (o.outreach || []).length) setSelectedId((o.outreach || [])[0].id);
    } catch {
      toast.error("Failed to load outreach demo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inviteSupplier = async () => {
    const supplier_name = inviteForm.supplier_name?.trim();
    const supplier_email = inviteForm.supplier_email?.trim();
    if (!supplier_name) {
      toast.error("Supplier name is required");
      return;
    }
    if (!supplier_email || !supplier_email.includes("@")) {
      toast.error("Valid supplier email is required");
      return;
    }

    const chosen = (catalog || []).find((c) => c.id === inviteForm.channel_id);
    const channel =
      inviteForm.channel_id === "email_sftp"
        ? { type: "email", connector_id: "email_sftp", label: "Email / SFTP Drop" }
        : { type: "connector", connector_id: inviteForm.channel_id, label: chosen?.name || inviteForm.channel_id };

    try {
      const res = await outreachClient.inviteSupplier({ supplier_name, supplier_email, channel });
      const row = res.outreach;
      setRows((prev) => [row, ...(prev || [])]);
      setSelectedId(row.id);
      setInviteForm((p) => ({ ...p, supplier_name: "", supplier_email: "" }));
      toast.success("Invite sent (demo)");
    } catch {
      toast.error("Invite failed");
    }
  };

  const requestEvidence = async () => {
    if (!selected) {
      toast.error("Select a supplier");
      return;
    }
    try {
      const res = await outreachClient.requestEvidence({
        outreach_id: selected.id,
        type: evidenceForm.type,
        message: evidenceForm.message,
        due_date: evidenceForm.due_date || null,
      });
      setRows((prev) => (prev || []).map((r) => (r.id === selected.id ? res.outreach : r)));
      toast.success("Evidence requested (demo)");
    } catch {
      toast.error("Request failed");
    }
  };

  const remind = async () => {
    if (!selected) return;
    const res = await outreachClient.remind({ outreach_id: selected.id });
    setRows((prev) => (prev || []).map((r) => (r.id === selected.id ? res.outreach : r)));
    toast.success("Reminder sent (demo)");
  };

  const markReceived = async () => {
    if (!selected || !latestRequest) {
      toast.error("No evidence request to mark received");
      return;
    }
    const res = await outreachClient.markEvidenceReceived({ outreach_id: selected.id, request_id: latestRequest.id });
    setRows((prev) => (prev || []).map((r) => (r.id === selected.id ? res.outreach : r)));
    toast.success("Evidence received (demo)");
  };

  const verify = async () => {
    if (!selected) return;
    const res = await outreachClient.verify({ outreach_id: selected.id });
    setRows((prev) => (prev || []).map((r) => (r.id === selected.id ? res.outreach : r)));
    toast.success("Verified (demo)");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="bg-[#121212] border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Vendor outreach</div>
              <div className="text-sm text-gray-300 mt-1">Invite suppliers and request evidence</div>
            </div>
            <Badge className="bg-white/5 text-gray-300 border-white/10">demo</Badge>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Supplier name</div>
              <Input
                value={inviteForm.supplier_name}
                onChange={(e) => setInviteForm((p) => ({ ...p, supplier_name: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10"
                placeholder="Acme Plastics"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Supplier email</div>
              <Input
                value={inviteForm.supplier_email}
                onChange={(e) => setInviteForm((p) => ({ ...p, supplier_email: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10"
                placeholder="sustainability@acme.example"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Channel</div>
              <Select value={inviteForm.channel_id} onValueChange={(v) => setInviteForm((p) => ({ ...p, channel_id: v }))}>
                <SelectTrigger className="bg-[#0A0A0A] border-white/10">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent className="bg-[#121212] border-white/10">
                  <SelectItem value="email_sftp">Email / SFTP Drop</SelectItem>
                  {vendorPortalConnectors
                    .filter((c) => c.id !== "email_sftp")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-black" onClick={inviteSupplier} disabled={loading}>
              Send invite
            </Button>
            <div className="text-xs text-gray-500">
              This is a hardcoded demo flow (stored in localStorage). It does not send real emails.
            </div>
          </div>
        </Card>

        <Card className="bg-[#121212] border-white/10 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Evidence request</div>
          <div className="text-sm text-gray-300 mt-1">{selected ? selected.supplier_name : "Select a supplier"}</div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evidence type</div>
              <Select value={evidenceForm.type} onValueChange={(v) => setEvidenceForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger className="bg-[#0A0A0A] border-white/10">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-[#121212] border-white/10">
                  {EVIDENCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Due date (optional)</div>
              <Input
                type="date"
                value={evidenceForm.due_date}
                onChange={(e) => setEvidenceForm((p) => ({ ...p, due_date: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10"
              />
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Message</div>
              <Textarea
                value={evidenceForm.message}
                onChange={(e) => setEvidenceForm((p) => ({ ...p, message: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10 min-h-[110px]"
              />
            </div>

            <Button className="w-full" variant="secondary" onClick={requestEvidence} disabled={loading || !selected}>
              Request evidence
            </Button>

            <div className="flex gap-2">
              <Button className="flex-1" variant="outline" onClick={remind} disabled={!selected}>
                Remind
              </Button>
              <Button className="flex-1" variant="outline" onClick={markReceived} disabled={!selected || !latestRequest}>
                Mark received
              </Button>
              <Button className="flex-1" onClick={verify} disabled={!selected}>
                Verify
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-[#121212] border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Suppliers</div>
              <div className="text-sm text-gray-300 mt-1">{rows.length} outreach record(s)</div>
            </div>
            <Button variant="secondary" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-gray-400 uppercase tracking-wider text-xs">Supplier</TableHead>
                  <TableHead className="text-gray-400 uppercase tracking-wider text-xs">Channel</TableHead>
                  <TableHead className="text-gray-400 uppercase tracking-wider text-xs">Status</TableHead>
                  <TableHead className="text-gray-400 uppercase tracking-wider text-xs">Reminders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows || []).map((r) => (
                  <TableRow
                    key={r.id}
                    className={`border-white/5 cursor-pointer ${r.id === selectedId ? "bg-white/5" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <TableCell className="text-white font-medium">{r.supplier_name}</TableCell>
                    <TableCell className="text-gray-300 text-sm">{formatChannel(r.channel)}</TableCell>
                    <TableCell>
                      <Badge className={`${statusStyle[r.status] || statusStyle.invited} border-0`}>
                        {(r.status || "invited").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300 text-sm">{r.reminders || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="bg-[#121212] border-white/10 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Details</div>
          {!selected ? (
            <div className="text-gray-400 mt-3">Select a supplier to view evidence requests and activity.</div>
          ) : (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-white font-semibold">{selected.supplier_name}</div>
                <div className="text-xs text-gray-400 mt-1">{selected.supplier_email}</div>
                <div className="text-xs text-gray-400 mt-2">
                  <span className="text-gray-500">Channel:</span> {formatChannel(selected.channel)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  <span className="text-gray-500">Updated:</span> {selected.updated_at}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Evidence requests</div>
                <div className="mt-3 space-y-2">
                  {(selected.evidence_requests || []).length ? (
                    (selected.evidence_requests || []).slice(0, 4).map((e) => (
                      <div key={e.id} className="rounded-md border border-white/10 bg-[#0A0A0A] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-white">{e.type}</div>
                          <Badge className="bg-white/5 text-gray-300 border-white/10">{e.status}</Badge>
                        </div>
                        {e.due_date ? <div className="text-xs text-gray-400 mt-1">Due {e.due_date}</div> : null}
                        <div className="text-xs text-gray-400 mt-2">{e.message}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-sm">No evidence requests yet.</div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Activity</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(selected.timeline || []).slice(0, 8).map((t, idx) => (
                    <div key={`${t.at}_${idx}`} className="rounded-md border border-white/10 bg-[#0A0A0A] p-3">
                      <div className="text-xs text-gray-400">{t.at}</div>
                      <div className="text-sm text-white mt-1">{t.action.replace(/_/g, " ")}</div>
                      <div className="text-xs text-gray-400 mt-1">{t.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
