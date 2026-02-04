import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/App";
import { 
  Leaf, BarChart3, TrendingDown, Users, Settings, LogOut, 
  ChevronDown, ChevronUp, Sparkles, Copy, Check, ExternalLink,
  ArrowUpRight, ArrowDownRight, Minus, Grid3X3, List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Sidebar Component
const Sidebar = ({ user, onLogout }) => {
  const [activeItem, setActiveItem] = useState("reduce");

  return (
    <aside className="w-64 bg-[#121212] border-r border-white/10 flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-[#22C55E]" />
          </div>
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-white block">
              SCOPE3
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Carbon Intelligence</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="mb-6">
          <span className="text-xs text-gray-500 uppercase tracking-wider px-3 mb-2 block">Modules</span>
          <div className="space-y-1">
            <button
              onClick={() => setActiveItem("measure")}
              className={`sidebar-item w-full text-left ${activeItem === "measure" ? "active" : ""}`}
              data-testid="nav-measure"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Measure</span>
            </button>
            <button
              onClick={() => setActiveItem("reduce")}
              className={`sidebar-item w-full text-left ${activeItem === "reduce" ? "active" : ""}`}
              data-testid="nav-reduce"
            >
              <TrendingDown className="w-4 h-4" />
              <span>Reduce</span>
              <Badge className="ml-auto bg-[#22C55E]/20 text-[#22C55E] border-0 text-[10px]">AI</Badge>
            </button>
            <button
              onClick={() => setActiveItem("engage")}
              className={`sidebar-item w-full text-left ${activeItem === "engage" ? "active" : ""}`}
              data-testid="nav-engage"
            >
              <Users className="w-4 h-4" />
              <span>Engage</span>
            </button>
          </div>
        </div>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors" data-testid="user-menu-trigger">
              <div className="w-9 h-9 rounded-full bg-[#22C55E]/20 flex items-center justify-center overflow-hidden">
                {user?.picture ? (
                  <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#22C55E] font-semibold text-sm">
                    {user?.name?.charAt(0) || "U"}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white truncate">{user?.name || "User"}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || ""}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#121212] border-white/10">
            <DropdownMenuItem className="text-gray-400 hover:text-white hover:bg-white/5">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={onLogout}
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

// CEE Rating Badge
const CEERatingBadge = ({ rating }) => {
  const getRatingClass = (r) => {
    const grade = r.charAt(0).toUpperCase();
    if (grade === "A") return "rating-a";
    if (grade === "B") return "rating-b";
    if (grade === "C") return "rating-c";
    return "rating-d";
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-bold ${getRatingClass(rating)}`}>
      {rating}
    </span>
  );
};

// Impact Indicator
const ImpactIndicator = ({ value }) => {
  const getColor = (v) => {
    if (v >= 5) return "text-[#22C55E]";
    if (v >= 2) return "text-[#0EA5E9]";
    return "text-gray-400";
  };

  return (
    <div className="flex items-center gap-1">
      <span className={`font-mono font-bold ${getColor(value)}`}>
        {value.toFixed(2)}%
      </span>
      {value >= 3 && <ArrowUpRight className="w-3 h-3 text-[#22C55E]" />}
    </div>
  );
};

// Deep Dive Panel
const DeepDivePanel = ({ supplier, isOpen, onClose }) => {
  const [deepDive, setDeepDive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && supplier) {
      fetchDeepDive();
    }
  }, [isOpen, supplier]);

  const fetchDeepDive = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/suppliers/${supplier.id}/deep-dive`, {
        withCredentials: true,
      });
      setDeepDive(response.data);
    } catch (error) {
      console.error("Failed to fetch deep dive:", error);
      toast.error("Failed to load recommendation");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyClause = () => {
    if (deepDive?.content?.contract_clause) {
      navigator.clipboard.writeText(deepDive.content.contract_clause);
      setCopied(true);
      toast.success("Contract clause copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl bg-[#0A0A0A] border-l border-white/10 p-0 overflow-hidden"
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-white/10 glass">
            <SheetHeader>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#22C55E] sparkle-icon" />
                <span className="text-xs text-[#22C55E] uppercase tracking-wider font-display font-bold">
                  AI Recommendation
                </span>
              </div>
              <SheetTitle className="font-display text-2xl font-bold text-white tracking-tight">
                {supplier?.supplier_name}
              </SheetTitle>
              <SheetDescription className="text-gray-400">
                Reduction Action Plan for {deepDive?.meta?.category || supplier?.category}
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : deepDive ? (
              <div className="p-6 space-y-6">
                {/* Metrics Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="metric-card p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current</p>
                    <p className="font-mono text-xl font-bold text-white">
                      {deepDive.metrics.current_intensity.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">kgCO2e/unit</p>
                  </div>
                  <div className="metric-card p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Target</p>
                    <p className="font-mono text-xl font-bold text-[#22C55E]">
                      {deepDive.metrics.target_intensity.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">kgCO2e/unit</p>
                  </div>
                  <div className="metric-card p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Potential</p>
                    <p className="font-mono text-xl font-bold text-[#0EA5E9]">
                      -{deepDive.metrics.reduction_potential_percentage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">reduction</p>
                  </div>
                </div>

                {/* Peer Benchmark */}
                <div className="ai-indicator rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="w-4 h-4 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-white mb-1 uppercase tracking-tight">
                        Peer Benchmark: {deepDive.meta.peer_name}
                      </p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {deepDive.content.headline}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Case Study */}
                <div>
                  <h4 className="font-display font-bold text-white mb-3 uppercase tracking-tight text-sm">
                    Case Study
                  </h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {deepDive.content.case_study_summary}
                  </p>
                </div>

                {/* Action Plan */}
                <div>
                  <h4 className="font-display font-bold text-white mb-3 uppercase tracking-tight text-sm">
                    Recommended Actions
                  </h4>
                  <div className="space-y-3">
                    {deepDive.content.action_plan?.map((action, index) => (
                      <div key={index} className="action-step">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0 text-[#22C55E] text-xs font-bold">
                            {action.step}
                          </span>
                          <div>
                            <p className="font-semibold text-white text-sm mb-1">{action.title}</p>
                            <p className="text-gray-400 text-sm">{action.detail}</p>
                            {action.citation && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                Source: {action.citation}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="metric-card p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Feasibility Timeline</p>
                  <p className="font-display font-bold text-white text-lg">
                    {deepDive.content.feasibility_timeline}
                  </p>
                </div>

                {/* Contract Clause */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-display font-bold text-white uppercase tracking-tight text-sm">
                      Suggested Contract Clause
                    </h4>
                    <Button
                      size="sm"
                      onClick={handleCopyClause}
                      className={`
                        ${copied 
                          ? 'bg-[#22C55E] text-black' 
                          : 'bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/30'
                        }
                        border-0 rounded-sm uppercase tracking-wider text-xs font-bold
                      `}
                      data-testid="copy-clause-btn"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Copy Clause
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="contract-clause">
                    {deepDive.content.contract_clause}
                  </div>
                </div>

                {/* Sources */}
                {deepDive.content.source_docs?.length > 0 && (
                  <div>
                    <h4 className="font-display font-bold text-white mb-3 uppercase tracking-tight text-sm">
                      Sources
                    </h4>
                    <div className="space-y-2">
                      {deepDive.content.source_docs.map((doc, index) => (
                        <a
                          key={index}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-[#0EA5E9] hover:text-[#0EA5E9]/80 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {doc.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Heatmap Component
const Heatmap = ({ data, onCellClick }) => {
  const getColor = (intensity) => {
    if (intensity < 0.3) return "bg-[#22C55E]";
    if (intensity < 0.4) return "bg-[#22C55E]/70";
    if (intensity < 0.5) return "bg-[#F59E0B]";
    if (intensity < 0.6) return "bg-[#F59E0B]/70";
    return "bg-[#EF4444]";
  };

  const categories = [...new Set(data.map(d => d.category))];
  
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-4">
      {data.map((supplier, index) => (
        <TooltipProvider key={supplier.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onCellClick(supplier)}
                className={`heatmap-cell ${getColor(supplier.supplier_intensity)} cursor-pointer`}
                data-testid={`heatmap-cell-${index}`}
              />
            </TooltipTrigger>
            <TooltipContent className="bg-[#121212] border-white/10 p-3">
              <p className="font-semibold text-white text-sm">{supplier.supplier_name}</p>
              <p className="text-gray-400 text-xs">{supplier.category}</p>
              <p className="text-[#22C55E] text-xs mt-1">
                {supplier.potential_reduction_pct.toFixed(1)}% reduction potential
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
};

// Main Dashboard
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // table or heatmap
  const [sortConfig, setSortConfig] = useState({ key: "upstream_impact_pct", direction: "desc" });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      // First seed the data
      await axios.post(`${API}/seed-data`, {}, { withCredentials: true });
      
      // Then fetch suppliers
      const response = await axios.get(`${API}/suppliers`, {
        withCredentials: true,
      });
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
      console.error("Logout error:", error);
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
    
    if (typeof aVal === "string") {
      return aVal.localeCompare(bVal) * modifier;
    }
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

  // Calculate summary stats
  const totalUpstreamImpact = suppliers.reduce((sum, s) => sum + s.upstream_impact_pct, 0);
  const avgReduction = suppliers.length > 0 
    ? suppliers.reduce((sum, s) => sum + s.potential_reduction_pct, 0) / suppliers.length 
    : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Sidebar user={user} onLogout={handleLogout} />
      
      {/* Main Content */}
      <main className="ml-64 p-8">
        {/* Header */}
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

        {/* Summary Stats */}
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

        {/* View Toggle */}
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

        {/* Content */}
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
                    <div className="flex items-center">
                      Organization
                      <SortIcon column="supplier_name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("category")}
                  >
                    <div className="flex items-center">
                      Category
                      <SortIcon column="category" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("cee_rating")}
                  >
                    <div className="flex items-center">
                      CEE Rating
                      <SortIcon column="cee_rating" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("potential_reduction_pct")}
                  >
                    <div className="flex items-center">
                      Potential Red.
                      <SortIcon column="potential_reduction_pct" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-gray-400 font-display uppercase tracking-wider text-xs cursor-pointer hover:text-white"
                    onClick={() => handleSort("upstream_impact_pct")}
                    data-testid="sort-upstream-impact"
                  >
                    <div className="flex items-center">
                      Upstream Impact
                      <SortIcon column="upstream_impact_pct" />
                    </div>
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
                    style={{ animationDelay: `${index * 0.03}s` }}
                    data-testid={`supplier-row-${index}`}
                  >
                    <TableCell className="font-semibold text-white">
                      {supplier.supplier_name}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {supplier.category}
                    </TableCell>
                    <TableCell>
                      <CEERatingBadge rating={supplier.cee_rating} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[#0EA5E9]">
                        {supplier.potential_reduction_pct.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <ImpactIndicator value={supplier.upstream_impact_pct} />
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      vs. {supplier.peer_name}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-[#121212] border border-white/10 rounded-lg">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-display font-bold text-white uppercase tracking-tight">
                Carbon Intensity Heatmap
              </h3>
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

      {/* Deep Dive Panel */}
      <DeepDivePanel 
        supplier={selectedSupplier}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  );
}
