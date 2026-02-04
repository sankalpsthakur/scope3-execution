import { FileText } from "lucide-react";

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <main className="ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-[#22C55E]" />
            <span className="text-sm text-gray-400 uppercase tracking-wider">Report Module</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mb-2">REPORT</h1>
          <p className="text-gray-400 max-w-2xl">
            V1 placeholder. In a full build, this would generate audit-ready reports and export packets for stakeholders.
          </p>
        </div>

        <div className="metric-card">
          <p className="text-sm text-gray-300">
            Recommended next step: connect real disclosures + citations and implement scheduled refresh (annual / nightly).
          </p>
        </div>
      </main>
    </div>
  );
}
