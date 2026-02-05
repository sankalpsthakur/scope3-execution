import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

import { Sidebar } from "@/components/Sidebar";
import ReduceDashboard from "@/pages/ReduceDashboard";
import EngagePage from "@/pages/EngagePage";
import MeasurePage from "@/pages/MeasurePage";
import ReportPage from "@/pages/ReportPage";
import EvidencePage from "@/pages/EvidencePage";
import QualityPage from "@/pages/QualityPage";
import IntegrationsPage from "@/pages/IntegrationsPage";

import { useAuth } from "@/App";
import { apiUrl } from "@/lib/api";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [engageFocusSupplierId, setEngageFocusSupplierId] = useState(null);

  const activeModule = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/dashboard/engage")) return "engage";
    if (path.startsWith("/dashboard/measure")) return "measure";
    if (path.startsWith("/dashboard/report")) return "report";
    if (path.startsWith("/dashboard/integrations")) return "integrations";
    if (path.startsWith("/dashboard/evidence")) return "evidence";
    if (path.startsWith("/dashboard/quality")) return "quality";
    return "reduce";
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await axios.post(apiUrl("/auth/logout"), {}, { withCredentials: true });
      navigate("/", { replace: true });
    } catch {
      navigate("/", { replace: true });
    }
  };

  const content = useMemo(() => {
    if (activeModule === "measure") return <MeasurePage />;
    if (activeModule === "engage") return <EngagePage focusSupplierId={engageFocusSupplierId} />;
    if (activeModule === "report") return <ReportPage />;
    if (activeModule === "integrations") return <IntegrationsPage />;
    if (activeModule === "evidence") return <EvidencePage />;
    if (activeModule === "quality") return <QualityPage />;

    return (
      <ReduceDashboard
        onGoToEngage={(supplierId) => {
          setEngageFocusSupplierId(supplierId);
          navigate("/dashboard/engage");
        }}
      />
    );
  }, [activeModule, engageFocusSupplierId, navigate]);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Sidebar
        user={user}
        onLogout={handleLogout}
        activeItem={activeModule}
        onNavigate={(key) => {
          setEngageFocusSupplierId(null);
          if (key === "measure") navigate("/dashboard/measure");
          else if (key === "engage") navigate("/dashboard/engage");
          else if (key === "report") navigate("/dashboard/report");
          else if (key === "integrations") navigate("/dashboard/integrations");
          else if (key === "evidence") navigate("/dashboard/evidence");
          else if (key === "quality") navigate("/dashboard/quality");
          else navigate("/dashboard");
        }}
      />

      {content}
    </div>
  );
}
