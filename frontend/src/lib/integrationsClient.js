import axios from "axios";
import { API_BASE } from "@/lib/api";

const MOCK_STATE_KEY = "scope3.mock.integrations_state.v1";

const HARD_CODED_CATALOG = [
  {
    id: "sap_ariba",
    name: "SAP Ariba (Buying & Invoicing)",
    category: "Procure-to-Pay",
    auth: "OAuth / API",
    objects: ["suppliers", "purchase_orders", "invoices", "spend_categories"],
    notes: "Popular procurement network + P2P suite. Demo seeds invoice/spend lines into Measure.",
  },
  {
    id: "coupa",
    name: "Coupa",
    category: "Procure-to-Pay",
    auth: "API key",
    objects: ["suppliers", "invoices", "spend", "categories"],
    notes: "Common P2P platform. Demo seeds spend lines.",
  },
  {
    id: "oracle_fusion",
    name: "Oracle Fusion ERP",
    category: "ERP",
    auth: "OAuth / API",
    objects: ["gl", "ap_invoices", "vendors", "cost_centers"],
    notes: "Finance-led ERP source of truth for spend and AP.",
  },
  {
    id: "netsuite",
    name: "Oracle NetSuite",
    category: "ERP",
    auth: "Token-based",
    objects: ["gl", "ap_invoices", "vendors"],
    notes: "Common in high-growth and multi-subsidiary orgs.",
  },
  {
    id: "workday_financials",
    name: "Workday Financials",
    category: "ERP",
    auth: "OAuth / API",
    objects: ["suppliers", "invoices", "spend", "org_units"],
    notes: "Often paired with Workday HCM; finance + supplier master data.",
  },
  {
    id: "d365_finance",
    name: "Microsoft Dynamics 365 Finance",
    category: "ERP",
    auth: "OAuth / API",
    objects: ["gl", "ap_invoices", "vendors"],
    notes: "Common in enterprise Microsoft stacks.",
  },
  {
    id: "sap_concur",
    name: "SAP Concur (Travel & Expense)",
    category: "Travel",
    auth: "OAuth / API",
    objects: ["expenses", "trips", "air", "hotel", "rail"],
    notes: "Scope 3 Cat 6 (business travel) and employee spend signals.",
  },
  {
    id: "project44",
    name: "project44 (Logistics Visibility)",
    category: "Logistics",
    auth: "API key",
    objects: ["shipments", "legs", "modes", "weights", "distances"],
    notes: "Shipment activity data for Cat 4/9; demo seeds tonne-km.",
  },
  {
    id: "ariba_network",
    name: "Ariba Network",
    category: "Vendor Portals",
    auth: "Portal + API",
    objects: ["supplier_invites", "evidence_requests", "messages"],
    notes: "Vendor portal workflow: invite suppliers and collect evidence.",
  },
  {
    id: "coupa_supplier_portal",
    name: "Coupa Supplier Portal",
    category: "Vendor Portals",
    auth: "Portal + API",
    objects: ["supplier_invites", "questionnaires", "messages"],
    notes: "Supplier-side portal workflow: invite, request disclosures, track completion.",
  },
  {
    id: "tradeshift",
    name: "Tradeshift",
    category: "Vendor Portals",
    auth: "OAuth",
    objects: ["supplier_profiles", "documents", "messages"],
    notes: "Portal + invoicing network; track supplier participation.",
  },
  {
    id: "basware",
    name: "Basware Network",
    category: "Vendor Portals",
    auth: "OAuth / API",
    objects: ["suppliers", "documents", "messages"],
    notes: "Invoice-to-pay network with supplier participation tracking.",
  },
  {
    id: "tungsten",
    name: "Tungsten Network",
    category: "Vendor Portals",
    auth: "OAuth / API",
    objects: ["suppliers", "documents", "messages"],
    notes: "Invoice network; usable as a vendor outreach channel for evidence requests.",
  },
  {
    id: "ivalua",
    name: "Ivalua",
    category: "Vendor Portals",
    auth: "OAuth / API",
    objects: ["suppliers", "questionnaires", "documents"],
    notes: "SRM + sourcing suite; questionnaires are useful for ESG data collection.",
  },
  {
    id: "gepsmart",
    name: "GEP SMART",
    category: "Vendor Portals",
    auth: "OAuth / API",
    objects: ["suppliers", "events", "questionnaires"],
    notes: "Procurement suite; good fit for structured supplier ESG requests.",
  },
  {
    id: "ecovadis",
    name: "EcoVadis",
    category: "Vendor ESG",
    auth: "API key",
    objects: ["supplier_scorecards", "risk_flags"],
    notes: "Supplier ESG signals and remediation workflows (non-numeric).",
  },
  {
    id: "email_sftp",
    name: "Email / SFTP Drop",
    category: "Vendor Portals",
    auth: "SFTP",
    objects: ["csv_uploads", "pdfs", "attachments"],
    notes: "Lowest-friction path: suppliers upload CSV/PDF evidence.",
  },
  {
    id: "sftp_csv",
    name: "SFTP / CSV Feed",
    category: "File Feeds",
    auth: "SSH key",
    objects: ["gl_extracts", "invoice_feeds", "meter_reads"],
    notes: "Always-on enterprise fallback. Demo seeds spend + electricity kWh.",
  },
];

function nowIso() {
  return new Date().toISOString();
}

function readMockState() {
  try {
    const raw = localStorage.getItem(MOCK_STATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMockState(rows) {
  localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(rows || []));
}

function shouldFallbackToMock(err) {
  if (!err?.response) return true;
  const status = err?.response?.status;
  return status === 404 || status === 405 || status === 501;
}

async function getCatalog({ forceMock } = {}) {
  if (forceMock) return { connectors: HARD_CODED_CATALOG, source: "mock" };
  try {
    const res = await axios.get(`${API_BASE}/integrations/catalog`, { withCredentials: true });
    return { connectors: res?.data?.connectors || [], source: "backend" };
  } catch (err) {
    if (shouldFallbackToMock(err)) return { connectors: HARD_CODED_CATALOG, source: "mock" };
    throw err;
  }
}

async function getState({ forceMock } = {}) {
  if (forceMock) return { state: readMockState(), source: "mock" };
  try {
    const res = await axios.get(`${API_BASE}/integrations/state`, { withCredentials: true });
    return { state: res?.data?.state || [], source: "backend" };
  } catch (err) {
    if (shouldFallbackToMock(err)) return { state: readMockState(), source: "mock" };
    throw err;
  }
}

async function upsertState(payload, { forceMock } = {}) {
  if (forceMock) {
    const existing = readMockState();
    const next = existing.filter((r) => r.connector_id !== payload.connector_id);
    const row = {
      id: `mock_integration_${payload.connector_id}`,
      tenant_id: "mock",
      connector_id: payload.connector_id,
      display_name: payload.display_name || payload.connector_id,
      status: payload.status || "connected",
      config_summary: payload.config_summary || {},
      created_at: nowIso(),
      updated_at: nowIso(),
      last_sync_at: null,
    };
    writeMockState([row, ...next]);
    return { state: row, source: "mock" };
  }

  try {
    const res = await axios.post(`${API_BASE}/integrations/state`, payload, { withCredentials: true });
    return { state: res?.data?.state, source: "backend" };
  } catch (err) {
    if (shouldFallbackToMock(err)) return upsertState(payload, { forceMock: true });
    throw err;
  }
}

async function demoSync(connectorId, { period, forceMock } = {}) {
  if (forceMock) {
    const existing = readMockState();
    const row = existing.find((r) => r.connector_id === connectorId) || null;
    const nextRow = row
      ? { ...row, status: "connected", last_sync_at: nowIso(), updated_at: nowIso() }
      : {
          id: `mock_integration_${connectorId}`,
          tenant_id: "mock",
          connector_id: connectorId,
          display_name: connectorId,
          status: "connected",
          config_summary: { mode: "demo" },
          created_at: nowIso(),
          updated_at: nowIso(),
          last_sync_at: nowIso(),
        };
    writeMockState([nextRow, ...existing.filter((r) => r.connector_id !== connectorId)]);
    return { counts: { purchases: 5, activities: 2 }, source: "mock" };
  }

  try {
    const res = await axios.post(
      `${API_BASE}/integrations/${connectorId}/demo-sync`,
      {},
      { withCredentials: true, params: { period } }
    );
    return { counts: res?.data?.counts || {}, source: "backend" };
  } catch (err) {
    if (shouldFallbackToMock(err)) return demoSync(connectorId, { period, forceMock: true });
    throw err;
  }
}

export const integrationsClient = {
  getCatalog,
  getState,
  upsertState,
  demoSync,
};
