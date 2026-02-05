/**
 * demoMode.js — Axios adapter that intercepts all API calls and returns seed
 * data when REACT_APP_DEMO_MODE=true (or when the backend is unreachable).
 *
 * Install once at app startup (before any API calls):
 *   import { installDemoMode } from "@/lib/demoMode";
 *   installDemoMode();
 */

import axios from "axios";
import { SEED } from "@/lib/seedData";

/** True when the build was created with REACT_APP_DEMO_MODE=true */
export const IS_DEMO = process.env.REACT_APP_DEMO_MODE === "true";

// ───────────── helpers ─────────────

function ok(data, config) {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    config,
    request: {},
  };
}

function parseParams(config) {
  // Merge URL search params + config.params
  const params = { ...(config.params || {}) };
  try {
    const url = new URL(config.url, "http://localhost");
    url.searchParams.forEach((v, k) => {
      params[k] = v;
    });
  } catch {
    /* ignore */
  }
  return params;
}

function extractPath(url) {
  // Return the path segment after /api, e.g. "/suppliers/filter"
  const m = url.match(/\/api(\/.*)/);
  return m ? m[1] : url;
}

// ───────────── route matcher ─────────────

function route(config) {
  const method = (config.method || "get").toUpperCase();
  const path = extractPath(config.url || "");
  const params = parseParams(config);

  // ─── Auth ───
  if (path === "/auth/me") return SEED.authMe;
  if (path === "/auth/test-login" && method === "POST") return SEED.authTestLogin;
  if (path === "/auth/session" && method === "POST") return SEED.authTestLogin;

  // ─── Measure ───
  if (path === "/measure/seed" && method === "POST") return SEED.measureSeed;
  if (path === "/measure/overview") return SEED.measureOverview;

  // ─── Pipeline ───
  if (path === "/pipeline/run" && method === "POST") return SEED.pipelineRun;
  if (path === "/pipeline/sources/seed" && method === "POST") return SEED.pipelineSourcesSeed;
  if (path === "/pipeline/ingest" && method === "POST") return SEED.pipelineIngest;
  if (path === "/pipeline/generate" && method === "POST") return SEED.pipelineGenerate;

  // ─── Suppliers ───
  if (path === "/suppliers/filter") return SEED.suppliersFilter(params);
  if (path === "/suppliers/heatmap") return SEED.suppliersHeatmap;
  // deep-dive: /suppliers/{id}/deep-dive
  const ddMatch = path.match(/^\/suppliers\/([^/]+)\/deep-dive$/);
  if (ddMatch) return SEED.supplierDeepDive(ddMatch[1]);
  // export-pdf: /suppliers/{id}/export-pdf — return empty blob-like
  if (path.match(/^\/suppliers\/[^/]+\/export-pdf$/)) return new Blob(["demo-pdf"], { type: "application/pdf" });
  if (path === "/suppliers") return SEED.suppliers;

  // ─── Engagements ───
  // PUT /engagements/{id}
  const engPutMatch = path.match(/^\/engagements\/([^/]+)$/);
  if (engPutMatch && method === "PUT") {
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data || {};
    const existing = SEED.engagementById(engPutMatch[1]);
    return { ...existing, status: body.status || existing.status, notes: body.notes ?? existing.notes, updated_at: new Date().toISOString() };
  }
  // GET /engagements/{id}
  if (engPutMatch && method === "GET") return SEED.engagementById(engPutMatch[1]);
  if (path === "/engagements") return SEED.engagements;

  // ─── Quality ───
  const anomStatusMatch = path.match(/^\/quality\/anomalies\/([^/]+)\/status$/);
  if (anomStatusMatch && method === "POST") return { message: "Updated" };
  if (path === "/quality/anomalies/run" && method === "POST") return SEED.anomalyRun;
  if (path === "/quality/anomalies") return SEED.anomalies;

  // ─── Evidence / docs ───
  if (path === "/pipeline/docs") return SEED.docs;
  if (path === "/pipeline/docs/upload" && method === "POST") return { doc: SEED.docs.docs[0] };
  if (path === "/execution/document-pages") return SEED.documentPages(params.doc_id || "doc_basf_sr24");
  if (path.match(/^\/execution\/document-pages\/image/)) {
    return { page: { id: params.page_id, doc_id: "doc_basf_sr24", page_number: 1 }, image: null };
  }
  if (path === "/execution/render-and-store-page" && method === "POST") {
    return { page: { id: "page_1", page_number: 1 }, image: null };
  }
  if (path === "/execution/render-pdf-page" && method === "POST") {
    return { image: null };
  }
  if (path === "/execution/ocr" && method === "POST") {
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data || {};
    return { request_id: "demo_ocr_req", blocks: SEED.ocrBlocks(body.doc_id || "doc_basf_sr24", body.page_number || 1).blocks };
  }
  if (path === "/execution/ocr-blocks") return SEED.ocrBlocks(params.doc_id || "doc_basf_sr24", params.page_number || 1);
  if (path === "/execution/field-provenance" && method === "POST") return { message: "Saved provenance" };
  if (path === "/execution/field-provenance" && method === "GET") return SEED.fieldProvenance;
  const provDeleteMatch = path.match(/^\/execution\/field-provenance\/([^/]+)$/);
  if (provDeleteMatch && method === "DELETE") return { message: "Deleted" };

  // ─── Admin ───
  if (path === "/admin/audit") return SEED.audit;
  if (path === "/admin/metrics") return SEED.metrics;

  // ─── Integrations (usually handled by integrationsClient, but catch here too) ───
  if (path === "/integrations/catalog") return null; // Let integrationsClient mock handle it
  if (path === "/integrations/state") return null;
  if (path.match(/^\/integrations\/[^/]+\/demo-sync$/)) return { counts: { purchases: 5, activities: 2 }, source: "demo" };

  // ─── Reporting period locks ───
  if (path === "/execution/reporting-period-locks") {
    if (method === "POST") return { period: "last_12_months", status: "open", created_at: NOW };
    return { locks: [{ period: "last_12_months", status: "open", created_at: WEEK_AGO }] };
  }

  // Fallback: return empty object so pages don't crash
  return {};
}

// ───────────── installer ─────────────

const NOW = new Date().toISOString();
const WEEK_AGO = new Date(Date.now() - 7 * 86400_000).toISOString();

export function installDemoMode() {
  if (!IS_DEMO) return;

  // Replace the default axios adapter with our mock router
  axios.defaults.adapter = (config) =>
    new Promise((resolve) => {
      // Small delay to mimic network latency and let React render loading states
      setTimeout(() => {
        const data = route(config);
        resolve(ok(data, config));
      }, 80);
    });

  // eslint-disable-next-line no-console
  console.log(
    "%c[Demo Mode] All API calls are served from local seed data.",
    "color: #22C55E; font-weight: bold;"
  );
}
