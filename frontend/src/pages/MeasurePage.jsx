import { BarChart3 } from "lucide-react";

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
