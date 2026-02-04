import { ArrowUpRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const CEERatingBadge = ({ rating }) => {
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

export const ImpactIndicator = ({ value }) => {
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

export const Heatmap = ({ data, onCellClick }) => {
  const getColor = (intensity) => {
    if (intensity < 0.3) return "bg-[#22C55E]";
    if (intensity < 0.4) return "bg-[#22C55E]/70";
    if (intensity < 0.5) return "bg-[#F59E0B]";
    if (intensity < 0.6) return "bg-[#F59E0B]/70";
    return "bg-[#EF4444]";
  };
  
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
