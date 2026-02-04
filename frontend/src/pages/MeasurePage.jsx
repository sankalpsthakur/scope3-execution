import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const uncertaintyColor = {
  low: "bg-[#22C55E]/20 text-[#22C55E]",
  medium: "bg-[#F59E0B]/20 text-[#F59E0B]",
  high: "bg-[#EF4444]/20 text-[#EF4444]",
};

const qualityColor = {
  high: "bg-[#22C55E]/20 text-[#22C55E]",
  medium: "bg-[#0EA5E9]/20 text-[#0EA5E9]",
  low: "bg-[#EF4444]/20 text-[#EF4444]",
};

function IntensityBar({ value, max }) {
  if (value == null) {
    return <span className="text-xs text-gray-500">n/a</span>;
  }
  const pct = Math.min(100, (value / (max || value || 1)) * 100);
  return (
    <div className="w-full">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1 font-mono">{value.toExponential(2)} tCO₂e/$</p>
    </div>
  );
}


export default function MeasurePage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("last_12_months");
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Seed measure inputs for this demo (safe to call repeatedly).
        // NOTE: This keeps the Measure module non-empty in a MOCK environment.
        await axios.post(`${API}/measure/seed`, {}, { withCredentials: true });
        const res = await axios.get(`${API}/measure/overview`, {
          withCredentials: true,
          params: { period },
        });
        setOverview(res.data);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load Measure baseline");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [period]);

  const maxIntensity = useMemo(() => {
    const rows = overview?.top_suppliers || [];
    const vals = rows
      .map((r) => r.intensity_tco2e_per_usd)
      .filter((v) => typeof v === "number" && isFinite(v));
    return vals.length ? Math.max(...vals) : 0;
  }, [overview]);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <main className="ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-[#22C55E]" />
            <span className="text-sm text-gray-400 uppercase tracking-wider">Measure Module</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mb-2">MEASURE</h1>
              <p className="text-gray-400 max-w-2xl">
                Baseline upstream Scope 3 inventory (spend-based + activity-based), with coverage, uncertainty, and factor provenance.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={period === "last_12_months" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("last_12_months")}
                className={
                  period === "last_12_months"
                    ? "bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/30"
                    : "border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
                }
              >
                Last 12 months
              </Button>
              <Button
                variant={period === "fy2024" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("fy2024")}
                className={
                  period === "fy2024"
                    ? "bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/30"
                    : "border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
                }
              >
                FY2024
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
              >
                Refresh
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
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="metric-card">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Upstream</p>
                <p className="font-display text-3xl font-bold text-white">
                  {overview?.total_upstream_tco2e?.toFixed(0) || "0"}
                  <span className="text-lg text-gray-500 ml-1">tCO₂e</span>
                </p>
              </div>

              <div className="metric-card">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Coverage</p>
                <p className="font-display text-3xl font-bold text-[#22C55E]">{overview?.coverage_pct ?? 0}%</p>
                <p className="text-xs text-gray-500 mt-2">
                  % of emissions calculated with matched factors (method+category+region+year)
                </p>
              </div>

              <div className="metric-card">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Method Mix</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-white/5 text-gray-300 border border-white/10">Spend-based</Badge>
                  <Badge className="bg-white/5 text-gray-300 border border-white/10">Activity-based</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Spend-based typically higher uncertainty; activity-based medium.
                </p>
              </div>

              <div className="metric-card">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Uncertainty</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={uncertaintyColor.high}>High</Badge>
                  <Badge className={uncertaintyColor.medium}>Medium</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-2">Shown per supplier line item.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="metric-card">
                <h3 className="font-display font-bold text-white uppercase tracking-tight">Category breakdown</h3>
                <p className="text-sm text-gray-400 mt-1">Upstream emissions by Scope 3 category (tCO₂e)</p>

                <div className="mt-4 space-y-3">
                  {(overview?.category_breakdown || []).map((row) => {
                    const pct = overview?.total_upstream_tco2e
                      ? (row.tco2e / overview.total_upstream_tco2e) * 100
                      : 0;
                    return (
                      <div key={row.category}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm text-gray-200">{row.category}</p>
                          <p className="text-sm text-gray-400 font-mono">{row.tco2e.toFixed(0)} tCO₂e</p>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="metric-card">
                <h3 className="font-display font-bold text-white uppercase tracking-tight">Intensity</h3>
                <p className="text-sm text-gray-400 mt-1">Supplier emissions intensity (tCO₂e per $ spend)</p>

                <div className="mt-4 space-y-3">
                  {(overview?.top_suppliers || []).slice(0, 6).map((s) => (
                    <div key={s.supplier_id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-white font-semibold">{s.supplier_name}</p>
                        <p className="text-xs text-gray-400 font-mono">{s.tco2e.toFixed(0)} tCO₂e</p>
                      </div>
                      <IntensityBar value={s.intensity_tco2e_per_usd} max={maxIntensity} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-display font-bold text-white uppercase tracking-tight">Top suppliers</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Ranked by upstream emissions. Includes data quality + uncertainty to support audit-ready decision making.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Supplier</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">tCO₂e</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Spend ($)</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Intensity</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Quality</TableHead>
                    <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Uncertainty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overview?.top_suppliers || []).map((s) => (
                    <TableRow key={s.supplier_id} className="data-table-row border-white/5">
                      <TableCell className="font-semibold text-white">{s.supplier_name}</TableCell>
                      <TableCell className="text-gray-300 font-mono">{s.tco2e.toFixed(0)}</TableCell>
                      <TableCell className="text-gray-400 font-mono">
                        {s.spend_usd ? Intl.NumberFormat("en-US", { notation: "compact" }).format(s.spend_usd) : "n/a"}
                      </TableCell>
                      <TableCell>
                        <IntensityBar value={s.intensity_tco2e_per_usd} max={maxIntensity} />
                      </TableCell>
                      <TableCell>
                        <Badge className={qualityColor[s.data_quality] || qualityColor.medium}>{s.data_quality}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={uncertaintyColor[s.uncertainty] || uncertaintyColor.high}>{s.uncertainty}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 metric-card">
              <p className="text-sm text-gray-300">
                <b>Methodology (demo):</b> Spend-based uses sector-average factors (kgCO₂e/$). Activity-based uses
                unit factors (kgCO₂e/kWh, kgCO₂e/tonne-km). Factors include source/year/region/version, and uncertainty
                reflects the method.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
