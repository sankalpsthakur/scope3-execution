import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectorsTab } from "@/components/integrations/ConnectorsTab";
import { OutreachTab } from "@/components/integrations/OutreachTab";

function getTabFromSearch(search) {
  const params = new URLSearchParams(search || "");
  const v = params.get("tab");
  if (v === "outreach") return "outreach";
  return "connectors";
}

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const tab = useMemo(() => {
    if ((location.pathname || "").endsWith("/outreach")) return "outreach";
    return getTabFromSearch(location.search);
  }, [location.pathname, location.search]);

  const setTab = (next) => {
    if (next === "outreach") {
      navigate("/dashboard/integrations/outreach", { replace: true });
      return;
    }
    navigate("/dashboard/integrations", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white ml-64 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight">Integrations</h1>
          <p className="text-sm sm:text-base text-gray-400 mt-2">
            Connector showcase flows: connect popular ERP/procurement/vendor portal tools and run a deterministic demo
            sync into Measure. Includes a vendor outreach flow to invite suppliers and request evidence.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-[#0A0A0A] border border-white/10">
            <TabsTrigger value="connectors">Connectors</TabsTrigger>
            <TabsTrigger value="outreach">Vendor outreach</TabsTrigger>
          </TabsList>

          <TabsContent value="connectors" className="mt-6">
            <ConnectorsTab onAfterDemoSync={() => navigate("/dashboard/measure")} />
          </TabsContent>

          <TabsContent value="outreach" className="mt-6">
            <OutreachTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
