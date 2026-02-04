import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Sparkles, Copy, Check, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from "@/components/ui/sheet";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const DeepDivePanel = ({ supplier, isOpen, onClose }) => {
  const [deepDive, setDeepDive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (isOpen && supplier) {
      fetchDeepDive();
    }
  }, [isOpen, supplier, fetchDeepDive]);

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

          <ScrollArea className="flex-1">
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

                <div className="metric-card p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Feasibility Timeline</p>
                  <p className="font-display font-bold text-white text-lg">
                    {deepDive.content.feasibility_timeline}
                  </p>
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
