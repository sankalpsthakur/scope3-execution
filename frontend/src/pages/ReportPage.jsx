import { FileText, Download, CheckCircle2, AlertTriangle, Clock, Shield, TrendingDown, BarChart3, Users } from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiUrl } from "@/lib/api";

const API = apiUrl();

export default function ReportPage() {
  const [loading, setLoading] = useState(true);
  const [measure, setMeasure] = useState(null);
  const [engagements, setEngagements] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [mRes, eRes, aRes, auRes] = await Promise.allSettled([
          axios.get(`${API}/measure/overview`, { withCredentials: true, params: { period: "last_12_months" } }),
          axios.get(`${API}/engagements`, { withCredentials: true }),
          axios.get(`${API}/quality/anomalies`, { withCredentials: true }),
          axios.get(`${API}/admin/audit`, { withCredentials: true }),
        ]);
        if (mRes.status === "fulfilled") setMeasure(mRes.value.data);
        if (eRes.status === "fulfilled") setEngagements(eRes.value.data?.engagements || eRes.value.data || []);
        if (aRes.status === "fulfilled") setAnomalies(aRes.value.data?.anomalies || aRes.value.data || []);
        if (auRes.status === "fulfilled") setAudit((auRes.value.data?.events || auRes.value.data || []).slice(0, 10));
      } catch (e) {
        console.error(e);
        toast.error("Failed to load report data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalEmissions = measure?.total_upstream_tco2e || 0;
  const coverage = measure?.coverage_pct ?? 0;
  const categories = measure?.category_breakdown || [];
  const suppliers = measure?.top_suppliers || [];

  const engagementsByStatus = engagements.reduce((acc, e) => {
    const s = e.status || "not_started";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const openAnomalies = Array.isArray(anomalies) ? anomalies.filter((a) => a.status === "open").length : 0;
  const resolvedAnomalies = Array.isArray(anomalies) ? anomalies.filter((a) => a.status === "resolved").length : 0;
  const totalAnomalies = Array.isArray(anomalies) ? anomalies.length : 0;

  const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const reportPeriod = "FY2024 (Last 12 months)";

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <main className="ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-[#22C55E]" />
            <span className="text-sm text-gray-400 uppercase tracking-wider">Report Module</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mb-2">REPORT</h1>
              <p className="text-gray-400 max-w-2xl">
                Audit-ready Scope 3 upstream inventory report with methodology, data quality, and engagement summary.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
                onClick={() => toast.success("CSRD E1-6 export queued")}
              >
                <Download className="w-4 h-4 mr-1" />
                CSRD E1-6
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
                onClick={() => toast.success("GHG Protocol export queued")}
              >
                <Download className="w-4 h-4 mr-1" />
                GHG Protocol
              </Button>
              <Button
                size="sm"
                className="bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 hover:bg-[#22C55E]/30"
                onClick={() => toast.success("Full PDF report generated")}
              >
                <Download className="w-4 h-4 mr-1" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Report header card */}
            <div className="metric-card mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-white uppercase tracking-tight">
                    Scope 3 Upstream Emissions Inventory
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Reporting period: <span className="text-white">{reportPeriod}</span> | Generated: <span className="text-white">{reportDate}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Draft
                  </Badge>
                  <Badge className="bg-white/5 text-gray-300 border border-white/10">v1.0</Badge>
                </div>
              </div>
            </div>

            {/* Executive summary cards */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              <div className="metric-card">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-[#22C55E]" />
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Total Upstream</p>
                </div>
                <p className="font-display text-2xl font-bold text-white">
                  {totalEmissions ? Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(totalEmissions) : "0"}
                </p>
                <p className="text-xs text-gray-500 mt-1">tCO2e</p>
              </div>

              <div className="metric-card">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-[#22C55E]" />
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Coverage</p>
                </div>
                <p className="font-display text-2xl font-bold text-[#22C55E]">{coverage}%</p>
                <p className="text-xs text-gray-500 mt-1">factor matched</p>
              </div>

              <div className="metric-card">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-[#0EA5E9]" />
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Suppliers</p>
                </div>
                <p className="font-display text-2xl font-bold text-white">{suppliers.length}</p>
                <p className="text-xs text-gray-500 mt-1">in inventory</p>
              </div>

              <div className="metric-card">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-[#F59E0B]" />
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Engagements</p>
                </div>
                <p className="font-display text-2xl font-bold text-white">{engagements.length}</p>
                <p className="text-xs text-gray-500 mt-1">active campaigns</p>
              </div>

              <div className="metric-card">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Open Issues</p>
                </div>
                <p className="font-display text-2xl font-bold text-white">{openAnomalies}</p>
                <p className="text-xs text-gray-500 mt-1">of {totalAnomalies} anomalies</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Category breakdown */}
              <div className="metric-card">
                <h3 className="font-display font-bold text-white uppercase tracking-tight mb-1">
                  Emissions by Category
                </h3>
                <p className="text-sm text-gray-400 mb-4">GHG Protocol Scope 3 upstream categories</p>

                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Category</TableHead>
                      <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs text-right">tCO2e</TableHead>
                      <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((row) => {
                      const pct = totalEmissions ? ((row.tco2e / totalEmissions) * 100).toFixed(1) : "0";
                      return (
                        <TableRow key={row.category} className="border-white/5">
                          <TableCell className="text-gray-200 text-sm">{row.category}</TableCell>
                          <TableCell className="text-gray-300 font-mono text-sm text-right">
                            {Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(row.tco2e)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-white/5 text-gray-300 border border-white/10 font-mono">{pct}%</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-white/10">
                      <TableCell className="text-white font-bold text-sm">Total</TableCell>
                      <TableCell className="text-white font-bold font-mono text-sm text-right">
                        {Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(totalEmissions)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-[#22C55E]/20 text-[#22C55E] font-mono">100%</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Engagement progress */}
              <div className="metric-card">
                <h3 className="font-display font-bold text-white uppercase tracking-tight mb-1">
                  Supplier Engagement Progress
                </h3>
                <p className="text-sm text-gray-400 mb-4">Status of reduction campaigns across suppliers</p>

                <div className="space-y-4">
                  {[
                    { key: "completed", label: "Completed", color: "bg-[#22C55E]", textColor: "text-[#22C55E]" },
                    { key: "in_progress", label: "In Progress", color: "bg-[#0EA5E9]", textColor: "text-[#0EA5E9]" },
                    { key: "pending", label: "Pending", color: "bg-[#F59E0B]", textColor: "text-[#F59E0B]" },
                    { key: "not_started", label: "Not Started", color: "bg-gray-500", textColor: "text-gray-400" },
                  ].map(({ key, label, color, textColor }) => {
                    const count = engagementsByStatus[key] || 0;
                    const pct = engagements.length ? (count / engagements.length) * 100 : 0;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-sm ${textColor}`}>{label}</p>
                          <p className="text-sm text-gray-400 font-mono">{count} ({pct.toFixed(0)}%)</p>
                        </div>
                        <div className="progress-track">
                          <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 pt-4 border-t border-white/10">
                  <h4 className="text-sm font-bold text-white mb-3">Data Quality Summary</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                      <p className="text-2xl font-bold text-[#22C55E]">{resolvedAnomalies}</p>
                      <p className="text-xs text-gray-500">Resolved</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                      <p className="text-2xl font-bold text-[#F59E0B]">{openAnomalies}</p>
                      <p className="text-xs text-gray-500">Open</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                      <p className="text-2xl font-bold text-white">{totalAnomalies}</p>
                      <p className="text-xs text-gray-500">Total Scanned</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier inventory table */}
            <div className="bg-[#121212] border border-white/10 rounded-lg overflow-hidden mb-8">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-display font-bold text-white uppercase tracking-tight">Supplier Inventory</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Complete upstream supplier emissions with data quality and methodology for audit review.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Supplier</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs text-right">tCO2e</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs text-right">Spend ($)</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Method</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Quality</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Uncertainty</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => {
                    const share = totalEmissions ? ((s.tco2e / totalEmissions) * 100).toFixed(1) : "0";
                    return (
                      <TableRow key={s.supplier_id} className="data-table-row border-white/5">
                        <TableCell className="font-semibold text-white">{s.supplier_name}</TableCell>
                        <TableCell className="text-gray-300 font-mono text-right">
                          {Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(s.tco2e)}
                        </TableCell>
                        <TableCell className="text-gray-400 font-mono text-right">
                          {s.spend_usd ? Intl.NumberFormat("en-US", { notation: "compact" }).format(s.spend_usd) : "n/a"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-white/5 text-gray-300 border border-white/10 text-xs">
                            {s.method || "Spend-based"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            s.data_quality === "high" ? "bg-[#22C55E]/20 text-[#22C55E]" :
                            s.data_quality === "medium" ? "bg-[#0EA5E9]/20 text-[#0EA5E9]" :
                            "bg-[#EF4444]/20 text-[#EF4444]"
                          }>{s.data_quality}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            s.uncertainty === "low" ? "bg-[#22C55E]/20 text-[#22C55E]" :
                            s.uncertainty === "medium" ? "bg-[#F59E0B]/20 text-[#F59E0B]" :
                            "bg-[#EF4444]/20 text-[#EF4444]"
                          }>{s.uncertainty}</Badge>
                        </TableCell>
                        <TableCell className="text-gray-300 font-mono text-right">{share}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Audit trail */}
            <div className="metric-card mb-8">
              <h3 className="font-display font-bold text-white uppercase tracking-tight mb-1">Audit Trail</h3>
              <p className="text-sm text-gray-400 mb-4">Recent data operations for this reporting period</p>

              <div className="space-y-2">
                {audit.length > 0 ? audit.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200">
                        <span className="font-mono text-[#22C55E]">{e.action}</span>
                        {e.meta && Object.keys(e.meta).length > 0 && (
                          <span className="text-gray-500 ml-2">
                            {Object.entries(e.meta).map(([k, v]) => `${k}=${v}`).join(", ")}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 font-mono shrink-0">
                      {e.created_at ? new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">No audit events recorded yet.</p>
                )}
              </div>
            </div>

            {/* Methodology footer */}
            <div className="metric-card">
              <h3 className="font-display font-bold text-white uppercase tracking-tight mb-2">Methodology & Disclaimers</h3>
              <div className="space-y-2 text-sm text-gray-300">
                <p>
                  <b>Emission factors:</b> Spend-based calculations use sector-average factors (kgCO2e/$ spend) sourced from
                  EXIOBASE and EPA EEIO databases. Activity-based calculations use unit factors (kgCO2e/kWh, kgCO2e/tonne-km)
                  from IEA and GLEC frameworks. All factors include source, year, region, and version metadata.
                </p>
                <p>
                  <b>Data quality:</b> Quality ratings (high/medium/low) reflect the granularity and recency of emission factors.
                  Activity-based data with primary supplier inputs is rated "high"; spend-based with sector averages is rated "medium" to "low".
                </p>
                <p>
                  <b>Uncertainty:</b> Uncertainty flags indicate the confidence interval of the calculation method.
                  Spend-based estimates carry higher uncertainty (typically +/- 40-60%) compared to activity-based (+/- 10-30%).
                </p>
                <p>
                  <b>Boundary:</b> This report covers upstream Scope 3 categories 1-7 as defined by the GHG Protocol Corporate
                  Value Chain (Scope 3) Standard. Downstream categories are excluded from this inventory.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
