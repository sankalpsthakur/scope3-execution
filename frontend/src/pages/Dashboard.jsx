import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/App";
import { 
  TrendingDown, Sparkles, ChevronDown, ChevronUp, Grid3X3, List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { Sidebar } from "@/components/Sidebar";
import { DeepDivePanel } from "@/components/DeepDivePanel";
import { CEERatingBadge, ImpactIndicator, Heatmap } from "@/components/SupplierComponents";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [sortConfig, setSortConfig] = useState({ key: "upstream_impact_pct", direction: "desc" });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      await axios.post(`${API}/seed-data`, {}, { withCredentials: true });
      const response = await axios.get(`${API}/suppliers`, { withCredentials: true });
      setSuppliers(response.data.suppliers || []);
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
      toast.error("Failed to load supplier data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      navigate("/", { replace: true });
    } catch (error) {
      navigate("/", { replace: true });
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  const sortedSuppliers = [...suppliers].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    const modifier = sortConfig.direction === "desc" ? -1 : 1;
    if (typeof aVal === "string") return aVal.localeCompare(bVal) * modifier;
    return (aVal - bVal) * modifier;
  });

  const handleRowClick = (supplier) => {
    setSelectedSupplier(supplier);
    setIsPanelOpen(true);
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "desc" 
      ? <ChevronDown className="w-3 h-3 ml-1" />
      : <ChevronUp className="w-3 h-3 ml-1" />;
  };

  const totalUpstreamImpact = suppliers.reduce((sum, s) => sum + s.upstream_impact_pct, 0);
  const avgReduction = suppliers.length > 0 
    ? suppliers.reduce((sum, s) => sum + s.potential_reduction_pct, 0) / suppliers.length 
    : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Sidebar user={user} onLogout={handleLogout} />
      
      <main className="ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-[#22C55E]" />
            <span className="text-sm text-gray-400 uppercase tracking-wider">Reduce Module</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mb-2">
            TOP REDUCTION ACTIONS
          </h1>
          <p className="text-gray-400 max-w-2xl">
            These are the actions that will move the needle most for your supply chain. 
            Sorted by upstream impact to prioritize your negotiation efforts.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="metric-card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Suppliers Analyzed</p>
            <p className="font-display text-3xl font-bold text-white">{suppliers.length}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Upstream Impact</p>
            <p className="font-display text-3xl font-bold text-[#22C55E]">{totalUpstreamImpact.toFixed(1)}%</p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Avg. Reduction Potential</p>
            <p className="font-display text-3xl font-bold text-[#0EA5E9]">{avgReduction.toFixed(1)}%</p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">AI Recommendations</p>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#22C55E] sparkle-icon" />
              <p className="font-display text-3xl font-bold text-white">{suppliers.length}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={viewMode === "table" 
                ? "bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/30" 
                : "border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
              }
              data-testid="view-table-btn"
            >
              <List className="w-4 h-4 mr-2" />
              Recommendations
            </Button>
            <Button
              variant={viewMode === "heatmap" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("heatmap")}
              className={viewMode === "heatmap" 
                ? "bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/30" 
                : "border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
              }
              data-testid="view-heatmap-btn"
            >
              <Grid3X3 className="w-4 h-4 mr-2" />
              Intensity Heatmap
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : viewMode === "table" ? (
          <div className="bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead 
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("supplier_name")}
                    data-testid="sort-organization"
                  >
                    <div className="flex items-center">Organization<SortIcon column="supplier_name" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("category")}
                  >
                    <div className="flex items-center">Category<SortIcon column="category" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("cee_rating")}
                  >
                    <div className="flex items-center">CEE Rating<SortIcon column="cee_rating" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("potential_reduction_pct")}
                  >
                    <div className="flex items-center">Potential Red.<SortIcon column="potential_reduction_pct" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("upstream_impact_pct")}
                    data-testid="sort-upstream-impact"
                  >
                    <div className="flex items-center">Upstream Impact<SortIcon column="upstream_impact_pct" /></div>
                  </TableHead>
                  <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">
                    Peer Benchmark
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSuppliers.map((supplier, index) => (
                  <TableRow 
                    key={supplier.id}
                    className="data-table-row clickable border-white/5"
                    onClick={() => handleRowClick(supplier)}
                    data-testid={`supplier-row-${index}`}
                  >
                    <TableCell className="font-semibold text-white">{supplier.supplier_name}</TableCell>
                    <TableCell className="text-gray-400 text-sm">{supplier.category}</TableCell>
                    <TableCell><CEERatingBadge rating={supplier.cee_rating} /></TableCell>
                    <TableCell>
                      <span className="font-mono text-[#0EA5E9]">{supplier.potential_reduction_pct.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell><ImpactIndicator value={supplier.upstream_impact_pct} /></TableCell>
                    <TableCell className="text-gray-400 text-sm">vs. {supplier.peer_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-[#121212] border border-white/10 rounded-lg">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-display font-bold text-white uppercase tracking-tight">Carbon Intensity Heatmap</h3>
              <p className="text-gray-400 text-sm mt-1">
                Click any cell to view AI recommendations. Color indicates intensity (Green = Low, Red = High)
              </p>
            </div>
            <Heatmap data={suppliers} onCellClick={handleRowClick} />
            <div className="p-4 border-t border-white/10 flex items-center gap-4">
              <span className="text-xs text-gray-500">Intensity Scale:</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#22C55E]" />
                <span className="text-xs text-gray-400">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#F59E0B]" />
                <span className="text-xs text-gray-400">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#EF4444]" />
                <span className="text-xs text-gray-400">High</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <DeepDivePanel 
        supplier={selectedSupplier}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  );
}
