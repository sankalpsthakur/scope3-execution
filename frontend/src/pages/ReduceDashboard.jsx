import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  TrendingDown,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Grid3X3,
  List,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

import { DeepDivePanel } from "@/components/DeepDivePanel";
import {
  CEERatingBadge,
  ImpactIndicator,
  Heatmap,
  EngagementBadge,
} from "@/components/SupplierComponents";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SortIcon = ({ sortConfig, column }) => {
  if (sortConfig.key !== column) return null;
  return sortConfig.direction === "desc" ? (
    <ChevronDown className="w-3 h-3 ml-1" />
  ) : (
    <ChevronUp className="w-3 h-3 ml-1" />
  );
};

export default function ReduceDashboard({ onGoToEngage }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [sortConfig, setSortConfig] = useState({
    key: "upstream_impact_pct",
    direction: "desc",
  });
  const [engagements, setEngagements] = useState({});
  const [heatmapData, setHeatmapData] = useState([]);

  const fetchHeatmap = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/suppliers/heatmap`, { withCredentials: true });
      setHeatmapData(res.data.heatmap_data || []);
    } catch (e) {
      // Fallback to table data.
    }
  }, []);


  const [filters, setFilters] = useState({
    category: "all",
    rating: "all",
    minImpact: "",
    minReduction: "",
  });
  const [filterOptions, setFilterOptions] = useState({ categories: [], ratings: [] });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const fetchEngagements = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/engagements`, { withCredentials: true });
      const engagementMap = {};
      (response.data.engagements || []).forEach((e) => {
        engagementMap[e.supplier_id] = e;
      });
      setEngagements(engagementMap);
    } catch (error) {
      console.error("Failed to fetch engagements:", error);
    }
  }, []);

  const fetchFilteredSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.category && filters.category !== "all") params.category = filters.category;
      if (filters.rating && filters.rating !== "all") params.rating = filters.rating;
      if (filters.minImpact) params.min_impact = parseFloat(filters.minImpact);
      if (filters.minReduction) params.min_reduction = parseFloat(filters.minReduction);

      const response = await axios.get(`${API}/suppliers/filter`, {
        withCredentials: true,
        params,
      });

      const supplierData = response.data.suppliers || [];
      setSuppliers(supplierData);

      const apiFilters = response.data.filters;
      if (apiFilters?.categories && apiFilters?.ratings) {
        setFilterOptions({
          categories: apiFilters.categories,
          ratings: apiFilters.ratings,
        });
      } else {
        const categories = [...new Set(supplierData.map((s) => s.category))].sort();
        const ratings = [...new Set(supplierData.map((s) => s.cee_rating.charAt(0)))].sort();
        setFilterOptions({ categories, ratings });
      }
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
      toast.error("Failed to load supplier data");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    // Simulate pipeline output precomputation for the demo.
    const runPipeline = async () => {
      try {
        await axios.post(`${API}/pipeline/run`, {}, { withCredentials: true });
      } catch (e) {
        // If auth isn't ready yet, the caller will retry when the page is revisited.
      }
    };

    runPipeline();
    fetchEngagements();
    fetchHeatmap();
  }, [fetchEngagements, fetchHeatmap]);

  useEffect(() => {
    fetchFilteredSuppliers();
  }, [fetchFilteredSuppliers]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
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

  const clearFilters = () => {
    setFilters({ category: "all", rating: "all", minImpact: "", minReduction: "" });
  };

  const activeFilterCount = Object.entries(filters)
    .filter(([key, value]) => {
      if (key === "category" || key === "rating") return value !== "all";
      return value !== "";
    })
    .length;

  // SortIcon extracted to top-level to satisfy lint rules.


  const totalUpstreamImpact = suppliers.reduce((sum, s) => sum + (s.upstream_impact_pct || 0), 0);
  const avgReduction = suppliers.length > 0 ? suppliers.reduce((sum, s) => sum + (s.potential_reduction_pct || 0), 0) / suppliers.length : 0;

  const updateEngagement = async (supplierId, status) => {
    try {
      const response = await axios.put(`${API}/engagements/${supplierId}`, { status }, { withCredentials: true });
      setEngagements((prev) => ({ ...prev, [supplierId]: response.data }));
      toast.success("Engagement status updated");
    } catch (error) {
      toast.error("Failed to update engagement");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <main className="ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-[#22C55E]" />
            <span className="text-sm text-gray-400 uppercase tracking-wider">Reduce Module</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mb-2">TOP REDUCTION ACTIONS</h1>
          <p className="text-gray-400 max-w-2xl">
            Here are the actions that will move the needle most for your supply chain. Sorted by upstream impact.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="metric-card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Suppliers Shown</p>
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
              className={
                viewMode === "table"
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
              className={
                viewMode === "heatmap"
                  ? "bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/30"
                  : "border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
              }
              data-testid="view-heatmap-btn"
            >
              <Grid3X3 className="w-4 h-4 mr-2" />
              Intensity Heatmap
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
                  data-testid="filter-btn"
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-2 bg-[#22C55E] text-black text-[10px] px-1.5">{activeFilterCount}</Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-[#121212] border-white/10 p-4" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-bold text-white uppercase tracking-tight text-sm">Filters</h4>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-gray-400 hover:text-white h-6 px-2"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Category</label>
                    <Select
                      value={filters.category}
                      onValueChange={(v) => setFilters((prev) => ({ ...prev, category: v }))}
                    >
                      <SelectTrigger
                        className="bg-[#0A0A0A] border-white/10 text-white"
                        data-testid="filter-category"
                      >
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121212] border-white/10">
                        <SelectItem value="all">All Categories</SelectItem>
                        {filterOptions.categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">CEE Rating</label>
                    <Select
                      value={filters.rating}
                      onValueChange={(v) => setFilters((prev) => ({ ...prev, rating: v }))}
                    >
                      <SelectTrigger
                        className="bg-[#0A0A0A] border-white/10 text-white"
                        data-testid="filter-rating"
                      >
                        <SelectValue placeholder="All Ratings" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121212] border-white/10">
                        <SelectItem value="all">All Ratings</SelectItem>
                        {filterOptions.ratings.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
                      Min Upstream Impact (%)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g., 2.0"
                      value={filters.minImpact}
                      onChange={(e) => setFilters((prev) => ({ ...prev, minImpact: e.target.value }))}
                      className="bg-[#0A0A0A] border-white/10 text-white"
                      data-testid="filter-min-impact"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
                      Min Reduction Potential (%)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g., 15.0"
                      value={filters.minReduction}
                      onChange={(e) => setFilters((prev) => ({ ...prev, minReduction: e.target.value }))}
                      className="bg-[#0A0A0A] border-white/10 text-white"
                      data-testid="filter-min-reduction"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-gray-400 hover:text-white"
                data-testid="clear-filters-btn"
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.category !== "all" && (
              <Badge className="bg-[#22C55E]/20 text-[#22C55E] border-0">
                Category: {filters.category}
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => setFilters((prev) => ({ ...prev, category: "all" }))}
                />
              </Badge>
            )}
            {filters.rating !== "all" && (
              <Badge className="bg-[#0EA5E9]/20 text-[#0EA5E9] border-0">
                Rating: {filters.rating}
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => setFilters((prev) => ({ ...prev, rating: "all" }))}
                />
              </Badge>
            )}
            {filters.minImpact && (
              <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-0">
                Impact ≥ {filters.minImpact}%
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => setFilters((prev) => ({ ...prev, minImpact: "" }))}
                />
              </Badge>
            )}
            {filters.minReduction && (
              <Badge className="bg-[#A855F7]/20 text-[#A855F7] border-0">
                Reduction ≥ {filters.minReduction}%
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => setFilters((prev) => ({ ...prev, minReduction: "" }))}
                />
              </Badge>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
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
                    <div className="flex items-center">
                      Organization<SortIcon sortConfig={sortConfig} column="supplier_name" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("category")}
                  >
                    <div className="flex items-center">
                      Category<SortIcon sortConfig={sortConfig} column="category" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("cee_rating")}
                  >
                    <div className="flex items-center">
                      CEE Rating<SortIcon sortConfig={sortConfig} column="cee_rating" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("potential_reduction_pct")}
                  >
                    <div className="flex items-center">
                      Potential Red.<SortIcon sortConfig={sortConfig} column="potential_reduction_pct" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("upstream_impact_pct")}
                    data-testid="sort-upstream-impact"
                  >
                    <div className="flex items-center">
                      Upstream Impact<SortIcon sortConfig={sortConfig} column="upstream_impact_pct" />
                    </div>
                  </TableHead>
                  <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Status</TableHead>
                  <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Peer</TableHead>
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
                    <TableCell>
                      <CEERatingBadge rating={supplier.cee_rating} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[#0EA5E9]">{supplier.potential_reduction_pct.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell>
                      <ImpactIndicator value={supplier.upstream_impact_pct} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <EngagementBadge
                        status={engagements[supplier.id]?.status || "not_started"}
                        onStatusChange={(status) => updateEngagement(supplier.id, status)}
                      />
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">vs. {supplier.peer_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sortedSuppliers.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No suppliers match the current filters. Try adjusting your criteria.
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#121212] border border-white/10 rounded-lg">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-display font-bold text-white uppercase tracking-tight">Carbon Intensity Heatmap</h3>
              <p className="text-gray-400 text-sm mt-1">
                Click any cell to view AI recommendations. Color indicates intensity (Green = Low, Red = High)
              </p>
            </div>
            <Heatmap data={heatmapData.length ? heatmapData : sortedSuppliers} onCellClick={handleRowClick} />
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
        onGoToEngage={(supplierId) => {
          if (onGoToEngage) onGoToEngage(supplierId);
        }}
        onEngagementUpdate={(status) => {
          if (selectedSupplier) updateEngagement(selectedSupplier.id, status);
        }}
      />
    </div>
  );
}
