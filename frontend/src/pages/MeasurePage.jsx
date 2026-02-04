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
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <main className="ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-[#22C55E]" />
            <span className="text-sm text-gray-400 uppercase tracking-wider">Measure Module</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mb-2">MEASURE</h1>
          <p className="text-gray-400 max-w-2xl">
            V1 placeholder. In a full build, this would connect to your existing “Measure” database and show your baseline.
          </p>
        </div>

        <div className="metric-card">
          <p className="text-sm text-gray-300">
            This environment is running with a <b>MOCK dataset</b>. The Reduce module is the primary V1 feature.
          </p>
        </div>
      </main>
    </div>
  );
}
