import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Sparkles, Copy, Check, ExternalLink, FileDown, Clock, 
  MessageSquare, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api";

const API = apiUrl();

// Engagement status configuration
const ENGAGEMENT_STATUSES = {
  not_started: { label: "Not Started", color: "bg-gray-500/20 text-gray-400" },
  in_progress: { label: "In Progress", color: "bg-[#0EA5E9]/20 text-[#0EA5E9]" },
  pending_response: { label: "Pending Response", color: "bg-[#F59E0B]/20 text-[#F59E0B]" },
  completed: { label: "Completed", color: "bg-[#22C55E]/20 text-[#22C55E]" },
  on_hold: { label: "On Hold", color: "bg-[#EF4444]/20 text-[#EF4444]" }
};

export const DeepDivePanel = ({ supplier, isOpen, onClose, onEngagementUpdate, onGoToEngage }) => {
  const [deepDive, setDeepDive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [engagement, setEngagement] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const fetchDeepDive = useCallback(async () => {
    if (!supplier) return;
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
  }, [supplier]);

  const fetchEngagement = useCallback(async () => {
    if (!supplier) return;
    try {
      const response = await axios.get(`${API}/engagements/${supplier.id}`, {
        withCredentials: true,
      });
      setEngagement(response.data);
      setNotes(response.data.notes || "");
    } catch (error) {
      console.error("Failed to fetch engagement:", error);
    }
  }, [supplier]);

  useEffect(() => {
    if (isOpen && supplier) {
      fetchDeepDive();
      fetchEngagement();
    }
  }, [isOpen, supplier, fetchDeepDive, fetchEngagement]);

  const handleCopyClause = () => {
    if (deepDive?.content?.contract_clause) {
      navigator.clipboard.writeText(deepDive.content.contract_clause);
      setCopied(true);
      toast.success("Contract clause copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportPDF = async () => {
    if (!supplier) return;
    setExporting(true);
    try {
      const response = await axios.get(`${API}/suppliers/${supplier.id}/export-pdf`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recommendation_${supplier.supplier_name.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("Failed to export PDF:", error);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleEngagementChange = async (status) => {
    if (!supplier) return;
    try {
      const response = await axios.put(
        `${API}/engagements/${supplier.id}`,
        { status, notes },
        { withCredentials: true }
      );
      setEngagement(response.data);
      if (onEngagementUpdate) onEngagementUpdate(status);
      toast.success("Engagement status updated");
    } catch (error) {
      toast.error("Failed to update engagement");
    }
  };

  const handleSaveNotes = async () => {
    if (!supplier || !engagement) return;
    try {
      const response = await axios.put(
        `${API}/engagements/${supplier.id}`,
        { status: engagement.status, notes },
        { withCredentials: true }
      );
      setEngagement(response.data);
      toast.success("Notes saved");
      setShowNotes(false);
    } catch (error) {
      toast.error("Failed to save notes");
    }
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        // Radix calls onOpenChange(true) when opening; we only close when open becomes false.
        if (!open) onClose();
      }}
    >
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl bg-[#0A0A0A] border-l border-white/10 p-0 overflow-hidden"
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-white/10 glass">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[#22C55E] sparkle-icon" />
                  <span className="text-xs text-[#22C55E] uppercase tracking-wider font-display font-bold">
                    AI Recommendation
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={exporting || loading}
                  className="bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/30 border-0"
                  data-testid="export-pdf-btn"
                >
                  {exporting ? (
                    <div className="w-4 h-4 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 mr-1" />
                      Export PDF
                    </>
                  )}
                </Button>
              </div>
              <SheetTitle className="font-display text-2xl font-bold text-white tracking-tight">
                {supplier?.supplier_name}
              </SheetTitle>
              <SheetDescription className="text-gray-400">
                Reduction Action Plan for {deepDive?.meta?.category || supplier?.category}
              </SheetDescription>
            </SheetHeader>

            {/* Engagement Status Bar */}
            <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Engagement:</span>
                  <Select 
                    value={engagement?.status || "not_started"} 
                    onValueChange={handleEngagementChange}
                  >
                    <SelectTrigger className="w-[160px] h-8 bg-transparent border-white/10 text-white text-xs" data-testid="engagement-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-white/10">
                      {Object.entries(ENGAGEMENT_STATUSES).map(([key, value]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          <div className="flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${value.color.split(' ')[0]}`} />
                            {value.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotes(!showNotes)}
                  className="text-gray-400 hover:text-white h-8"
                  data-testid="toggle-notes-btn"
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Notes
                </Button>
              </div>
              
              {showNotes && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Add engagement notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-[#0A0A0A] border-white/10 text-white text-sm min-h-[80px]"
                    data-testid="engagement-notes"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      className="bg-[#22C55E] text-black hover:bg-[#22C55E]/90 h-7 text-xs"
                    >
                      Save Notes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : deepDive ? (
              <div className="p-6 space-y-6">
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

                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Narrative</p>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {deepDive.meta.supplier_name} is underperforming peer {deepDive.meta.peer_name}. Peer intensity is
                    lower ({deepDive.metrics.target_intensity.toFixed(2)} vs {deepDive.metrics.current_intensity.toFixed(2)}),
                    implying a {deepDive.metrics.reduction_potential_percentage.toFixed(1)}% reduction is technically feasible.
                  </p>
                </div>


                <div>
                  <h4 className="font-display font-bold text-white mb-3 uppercase tracking-tight text-sm">
                    Case Study
                  </h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {deepDive.content.case_study_summary}
                  </p>
                </div>

                <div>
                  <h4 className="font-display font-bold text-white mb-3 uppercase tracking-tight text-sm">
                    Recommended Actions
                  </h4>
                  {Array.isArray(deepDive.content.action_plan) && deepDive.content.action_plan.length > 0 ? (
                    <div className="space-y-3">
                      {deepDive.content.action_plan.map((action, index) => (
                        <div key={index} className="action-step">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0 text-[#22C55E] text-xs font-bold">
                              {action.step}
                            </span>
                            <div>
                              <p className="font-semibold text-white text-sm mb-1">{action.title}</p>
                              <p className="text-gray-400 text-sm">{action.detail}</p>
                              {action.citation && (
                                <p className="text-xs text-gray-500 mt-1 italic">Source: {action.citation}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-gray-300">
                        No peer-validated technical actions were found in the retrieved evidence. Use the contract clause
                        below to request a category-specific roadmap and supporting documentation.
                      </p>
                    </div>
                  )}
                </div>

                <div className="metric-card p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Feasibility Timeline</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (onGoToEngage && supplier) onGoToEngage(supplier.id);
                      }}
                      className="text-gray-400 hover:text-white h-7 px-2"
                      data-testid="go-to-engage-btn"
                    >
                      <Calendar className="w-4 h-4 mr-1" />
                      Engage
                    </Button>
                  </div>
                  <p className="font-display font-bold text-white text-lg">
                    {deepDive.content.feasibility_timeline}
                  </p>
                  {deepDive?.content?.evidence_status && deepDive.content.evidence_status !== "ok" && (
                    <p className="text-xs text-amber-400 mt-2">
                      Evidence status: {deepDive.content.evidence_status.replace(/_/g, " ")}. Actions may be unavailable.
                    </p>
                  )}
                </div>

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
                          <span>
                            {doc.title}
                            {doc.page ? <span className="text-gray-500"> (p. {doc.page})</span> : null}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {deepDive.content.source_citations?.length > 0 && (
                  <div>
                    <h4 className="font-display font-bold text-white mb-3 uppercase tracking-tight text-sm">
                      Evidence Excerpts
                    </h4>
                    <div className="space-y-3">
                      {deepDive.content.source_citations.slice(0, 6).map((c, idx) => (
                        <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-xs text-gray-400 uppercase tracking-wider">
                              {c.title}
                              {c.page ? <span className="text-gray-500"> • Page {c.page}</span> : null}
                            </p>
                            {c.url ? (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#0EA5E9] hover:text-[#0EA5E9]/80"
                              >
                                Open
                              </a>
                            ) : null}
                          </div>
                          <p className="text-sm text-gray-300 leading-relaxed">“{c.quote}”</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
