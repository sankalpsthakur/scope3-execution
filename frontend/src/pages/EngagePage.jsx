import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { DeepDivePanel } from "@/components/DeepDivePanel";
import { EngagementBadge } from "@/components/SupplierComponents";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EngagePage({ focusSupplierId }) {
  const [suppliers, setSuppliers] = useState([]);
  const [engagements, setEngagements] = useState({});
  const [loading, setLoading] = useState(true);

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supplierRes, engagementRes] = await Promise.all([
        axios.get(`${API}/suppliers`, { withCredentials: true }),
        axios.get(`${API}/engagements`, { withCredentials: true }),
      ]);

      const supplierData = supplierRes.data.suppliers || [];
      setSuppliers(supplierData);

      const engagementMap = {};
      (engagementRes.data.engagements || []).forEach((e) => {
        engagementMap[e.supplier_id] = e;
      });
      setEngagements(engagementMap);

      if (focusSupplierId) {
        const match = supplierData.find((s) => s.id === focusSupplierId);
        if (match) {
          setSelectedSupplier(match);
          setIsPanelOpen(true);
        }
      }
    } catch (e) {
      toast.error("Failed to load engagement data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSupplierId]);

  const updateEngagement = async (supplierId, status) => {
    try {
      const response = await axios.put(`${API}/engagements/${supplierId}`, { status }, { withCredentials: true });
      setEngagements((prev) => ({ ...prev, [supplierId]: response.data }));
      toast.success("Engagement status updated");
    } catch {
      toast.error("Failed to update engagement");
    }
  };

  const rows = useMemo(() => {
    return suppliers.map((s) => ({
      ...s,
      engagement_status: engagements[s.id]?.status || "not_started",
      updated_at: engagements[s.id]?.updated_at,
    }));
  }, [suppliers, engagements]);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <main className="ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-[#22C55E]" />
            <span className="text-sm text-gray-400 uppercase tracking-wider">Engage Module</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mb-2">SUPPLIER ENGAGEMENT</h1>
          <p className="text-gray-400 max-w-2xl">
            Track the status of your negotiations and requests. Use this to operationalize reduction actions.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Supplier</TableHead>
                  <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Category</TableHead>
                  <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Status</TableHead>
                  <TableHead className="text-gray-400 font-display uppercase tracking-wider text-xs">Next Step</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((supplier, index) => (
                  <TableRow
                    key={supplier.id}
                    className="data-table-row clickable border-white/5"
                    onClick={() => {
                      setSelectedSupplier(supplier);
                      setIsPanelOpen(true);
                    }}
                    data-testid={`engage-row-${index}`}
                  >
                    <TableCell className="font-semibold text-white">{supplier.supplier_name}</TableCell>
                    <TableCell className="text-gray-400 text-sm">{supplier.category}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <EngagementBadge
                        status={supplier.engagement_status}
                        onStatusChange={(status) => updateEngagement(supplier.id, status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-white/5 text-gray-300 border border-white/10">
                        {supplier.engagement_status === "not_started"
                          ? "Send data request"
                          : supplier.engagement_status === "in_progress"
                            ? "Review roadmap"
                            : supplier.engagement_status === "pending_response"
                              ? "Follow up"
                              : supplier.engagement_status === "completed"
                                ? "Verify evidence"
                                : "Re-scope"
                        }
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {rows.length === 0 && (
              <div className="p-8 text-center text-gray-500">No suppliers found.</div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            variant="outline"
            onClick={fetchData}
            className="border-white/20 text-gray-400 hover:text-white hover:bg-white/5"
            data-testid="refresh-engagements"
          >
            Refresh
          </Button>
        </div>
      </main>

      <DeepDivePanel
        supplier={selectedSupplier}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onEngagementUpdate={(status) => {
          if (selectedSupplier) updateEngagement(selectedSupplier.id, status);
        }}
      />
    </div>
  );
}
