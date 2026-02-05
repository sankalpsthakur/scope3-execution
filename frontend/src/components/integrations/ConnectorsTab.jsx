import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { integrationsClient } from "@/lib/integrationsClient";

const statusStyle = {
  not_connected: "bg-white/5 text-gray-300",
  connected: "bg-[#22C55E]/20 text-[#22C55E]",
  error: "bg-[#EF4444]/20 text-[#EF4444]",
};

function groupByCategory(connectors) {
  const map = new Map();
  for (const c of connectors || []) {
    const key = c.category || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export function ConnectorsTab({ onAfterDemoSync }) {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [stateRows, setStateRows] = useState([]);
  const [period, setPeriod] = useState("last_12_months");
  const [source, setSource] = useState({ catalog: "backend", state: "backend" });

  const stateById = useMemo(() => {
    const map = new Map();
    for (const r of stateRows || []) map.set(r.connector_id, r);
    return map;
  }, [stateRows]);

  const grouped = useMemo(() => groupByCategory(catalog), [catalog]);

  const load = async () => {
    setLoading(true);
    try {
      const [cat, st] = await Promise.all([integrationsClient.getCatalog(), integrationsClient.getState()]);
      setCatalog(cat.connectors || []);
      setStateRows(st.state || []);
      setSource({ catalog: cat.source, state: st.source });
    } catch (e) {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upsertRowInState = (row) => {
    if (!row?.connector_id) return;
    setStateRows((prev) => {
      const next = (prev || []).filter((r) => r.connector_id !== row.connector_id);
      return [row, ...next];
    });
  };

  const connect = async (c) => {
    try {
      const res = await integrationsClient.upsertState({
        connector_id: c.id,
        status: "connected",
        display_name: c.name,
        config_summary: { mode: "demo", auth: c.auth },
      });
      upsertRowInState(res.state);
      toast.success(`Connected: ${c.name}`);
    } catch {
      toast.error("Connect failed");
    }
  };

  const disconnect = async (c) => {
    try {
      const res = await integrationsClient.upsertState({
        connector_id: c.id,
        status: "not_connected",
        display_name: c.name,
      });
      upsertRowInState(res.state);
      toast.success(`Disconnected: ${c.name}`);
    } catch {
      toast.error("Disconnect failed");
    }
  };

  const demoSync = async (c) => {
    try {
      const res = await integrationsClient.demoSync(c.id, { period });
      const counts = res?.counts || {};
      toast.success(`Synced ${c.name}: ${counts.purchases || 0} purchases, ${counts.activities || 0} activities`);
      await load();
      if (onAfterDemoSync) onAfterDemoSync();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 423) toast.error(detail || "Period is locked");
      else toast.error("Demo sync failed");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="bg-[#121212] border-white/10 p-4 lg:col-span-1">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Demo controls</div>
            <Badge className="bg-white/5 text-gray-300 border-white/10">
              {source.catalog === "backend" && source.state === "backend" ? "backend" : "mock"}
            </Badge>
          </div>

          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Reporting period</div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="bg-[#0A0A0A] border-white/10">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent className="bg-[#121212] border-white/10">
                <SelectItem value="last_12_months">Last 12 months</SelectItem>
                <SelectItem value="fy2024">FY2024</SelectItem>
                <SelectItem value="ytd">YTD</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500 mt-2">
              If the period is locked, demo sync returns <span className="text-white">423 Locked</span>.
            </div>
          </div>

          <Button className="w-full" variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </Card>

      <div className="lg:col-span-2 space-y-6">
        {loading ? (
          <Card className="bg-[#121212] border-white/10 p-6 text-gray-400">Loading…</Card>
        ) : (
          grouped.map(([cat, items]) => (
            <Card key={cat} className="bg-[#121212] border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{cat}</div>
                  <div className="text-sm text-gray-300 mt-1">{items.length} connector(s)</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((c) => {
                  const st = stateById.get(c.id) || { status: "not_connected" };
                  const status = st.status || "not_connected";
                  return (
                    <div key={c.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold">{c.name}</div>
                          <div className="text-xs text-gray-400 mt-1">{c.notes}</div>
                        </div>
                        <Badge className={`${statusStyle[status] || statusStyle.not_connected} border-0`}>
                          {status.replace(/_/g, " ")}
                        </Badge>
                      </div>

                      <div className="mt-3 text-xs text-gray-400">
                        <div>
                          <span className="text-gray-500">Auth:</span> {c.auth}
                        </div>
                        <div className="mt-1">
                          <span className="text-gray-500">Objects:</span> {(c.objects || []).join(", ")}
                        </div>
                        {st.last_sync_at ? (
                          <div className="mt-1">
                            <span className="text-gray-500">Last sync:</span> {st.last_sync_at}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex gap-2">
                        {status !== "connected" ? (
                          <Button className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-black" onClick={() => connect(c)}>
                            Connect
                          </Button>
                        ) : (
                          <Button className="flex-1" variant="secondary" onClick={() => disconnect(c)}>
                            Disconnect
                          </Button>
                        )}

                        <Button className="flex-1" variant="outline" disabled={status !== "connected"} onClick={() => demoSync(c)}>
                          Demo sync
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

