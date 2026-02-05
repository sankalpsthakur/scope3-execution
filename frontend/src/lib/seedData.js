/**
 * seedData.js — Hardcoded, realistic demo data for all API endpoints.
 * Used by demoMode.js to serve responses without a backend / MongoDB.
 */

const NOW = new Date().toISOString();
const HOUR_AGO = new Date(Date.now() - 3600_000).toISOString();
const DAY_AGO = new Date(Date.now() - 86400_000).toISOString();
const WEEK_AGO = new Date(Date.now() - 7 * 86400_000).toISOString();

// ───────────────────────────── Suppliers (12) ─────────────────────────────

const SUPPLIERS = [
  { id: "ppg_001", supplier_id: "ppg_001", supplier_name: "PPG Industries", peer_id: "ppg_peer_1", peer_name: "RPM International", category: "Building Materials", cee_rating: "C", potential_reduction_pct: 28.5, upstream_impact_pct: 18.2, supplier_intensity: 0.0125, peer_intensity: 0.0085, isic_code: "2310", industry_sector: "Non-metallic Minerals", supplier_revenue_usd_m: 12500, peer_revenue_usd_m: 11800, revenue_band: "10-15B", comparison_year: "2024" },
  { id: "dow_001", supplier_id: "dow_001", supplier_name: "Dow Inc", peer_id: "dow_peer_1", peer_name: "BASF SE", category: "Chemicals", cee_rating: "D", potential_reduction_pct: 40.2, upstream_impact_pct: 20.1, supplier_intensity: 0.0132, peer_intensity: 0.0095, isic_code: "2011", industry_sector: "Basic Chemicals", supplier_revenue_usd_m: 44600, peer_revenue_usd_m: 78700, revenue_band: "40-50B", comparison_year: "2024" },
  { id: "ups_001", supplier_id: "ups_001", supplier_name: "UPS Logistics", peer_id: "ups_peer_1", peer_name: "FedEx", category: "Transport & Logistics", cee_rating: "C", potential_reduction_pct: 15.3, upstream_impact_pct: 23.1, supplier_intensity: 0.01, peer_intensity: 0.009, isic_code: "5320", industry_sector: "Courier Services", supplier_revenue_usd_m: 91000, peer_revenue_usd_m: 87700, revenue_band: ">50B", comparison_year: "2024" },
  { id: "intl_paper_001", supplier_id: "intl_paper_001", supplier_name: "International Paper", peer_id: "ip_peer_1", peer_name: "Suzano", category: "Paper & Pulp", cee_rating: "B", potential_reduction_pct: 22.1, upstream_impact_pct: 10.0, supplier_intensity: 0.0105, peer_intensity: 0.0078, isic_code: "1700", industry_sector: "Pulp & Paper", supplier_revenue_usd_m: 21200, peer_revenue_usd_m: 7500, revenue_band: "20-25B", comparison_year: "2024" },
  { id: "holcim_001", supplier_id: "holcim_001", supplier_name: "Holcim Ltd", peer_id: "holcim_peer_1", peer_name: "Heidelberg Materials", category: "Cement & Aggregates", cee_rating: "C", potential_reduction_pct: 35.8, upstream_impact_pct: 7.3, supplier_intensity: 0.0105, peer_intensity: 0.0062, isic_code: "2394", industry_sector: "Cement", supplier_revenue_usd_m: 27800, peer_revenue_usd_m: 22200, revenue_band: "25-30B", comparison_year: "2024" },
  { id: "basf_001", supplier_id: "basf_001", supplier_name: "BASF SE", peer_id: "basf_peer_1", peer_name: "Evonik Industries", category: "Chemicals", cee_rating: "A", potential_reduction_pct: 12.4, upstream_impact_pct: 5.8, supplier_intensity: 0.0068, peer_intensity: 0.0072, isic_code: "2012", industry_sector: "Specialty Chemicals", supplier_revenue_usd_m: 78700, peer_revenue_usd_m: 18100, revenue_band: ">50B", comparison_year: "2024" },
  { id: "maersk_001", supplier_id: "maersk_001", supplier_name: "Maersk", peer_id: "maersk_peer_1", peer_name: "CMA CGM", category: "Transport & Logistics", cee_rating: "B", potential_reduction_pct: 18.7, upstream_impact_pct: 4.5, supplier_intensity: 0.0088, peer_intensity: 0.0095, isic_code: "5012", industry_sector: "Ocean Freight", supplier_revenue_usd_m: 51000, peer_revenue_usd_m: 47200, revenue_band: ">50B", comparison_year: "2024" },
  { id: "arcelor_001", supplier_id: "arcelor_001", supplier_name: "ArcelorMittal", peer_id: "arcelor_peer_1", peer_name: "Nucor", category: "Steel & Metals", cee_rating: "D", potential_reduction_pct: 38.6, upstream_impact_pct: 3.2, supplier_intensity: 0.0145, peer_intensity: 0.0088, isic_code: "2410", industry_sector: "Iron & Steel", supplier_revenue_usd_m: 68300, peer_revenue_usd_m: 34700, revenue_band: ">50B", comparison_year: "2024" },
  { id: "schneider_001", supplier_id: "schneider_001", supplier_name: "Schneider Electric", peer_id: "schneider_peer_1", peer_name: "ABB Ltd", category: "Electrical Equipment", cee_rating: "A", potential_reduction_pct: 8.2, upstream_impact_pct: 2.1, supplier_intensity: 0.0042, peer_intensity: 0.0048, isic_code: "2710", industry_sector: "Electrical Equipment", supplier_revenue_usd_m: 36400, peer_revenue_usd_m: 32900, revenue_band: "35-40B", comparison_year: "2024" },
  { id: "saint_gobain_001", supplier_id: "saint_gobain_001", supplier_name: "Saint-Gobain", peer_id: "sg_peer_1", peer_name: "Knauf", category: "Building Materials", cee_rating: "B", potential_reduction_pct: 19.3, upstream_impact_pct: 2.8, supplier_intensity: 0.0092, peer_intensity: 0.0078, isic_code: "2310", industry_sector: "Non-metallic Minerals", supplier_revenue_usd_m: 51600, peer_revenue_usd_m: 14200, revenue_band: ">50B", comparison_year: "2024" },
  { id: "air_liquide_001", supplier_id: "air_liquide_001", supplier_name: "Air Liquide", peer_id: "al_peer_1", peer_name: "Linde", category: "Industrial Gases", cee_rating: "C", potential_reduction_pct: 24.1, upstream_impact_pct: 1.9, supplier_intensity: 0.0098, peer_intensity: 0.0075, isic_code: "2011", industry_sector: "Industrial Gases", supplier_revenue_usd_m: 29800, peer_revenue_usd_m: 33300, revenue_band: "25-30B", comparison_year: "2024" },
  { id: "siemens_energy_001", supplier_id: "siemens_energy_001", supplier_name: "Siemens Energy", peer_id: "se_peer_1", peer_name: "GE Vernova", category: "Energy Systems", cee_rating: "B", potential_reduction_pct: 16.9, upstream_impact_pct: 1.0, supplier_intensity: 0.0082, peer_intensity: 0.0071, isic_code: "2711", industry_sector: "Power Generation", supplier_revenue_usd_m: 34500, peer_revenue_usd_m: 33200, revenue_band: "30-35B", comparison_year: "2024" },
];

const CATEGORIES = [...new Set(SUPPLIERS.map((s) => s.category))];
const RATINGS = ["A", "B", "C", "D"];

// ───────────────────────────── Measure overview ─────────────────────────────

export const MEASURE_OVERVIEW = {
  total_upstream_tco2e: 1_843_200,
  coverage_pct: 78.4,
  category_breakdown: [
    { category: "Purchased Goods & Services", tco2e: 812_400 },
    { category: "Capital Goods", tco2e: 245_600 },
    { category: "Fuel & Energy Related", tco2e: 198_300 },
    { category: "Upstream Transportation", tco2e: 312_100 },
    { category: "Business Travel", tco2e: 87_500 },
    { category: "Employee Commuting", tco2e: 42_800 },
    { category: "Waste Generated", tco2e: 31_200 },
    { category: "Leased Assets", tco2e: 113_300 },
  ],
  top_suppliers: SUPPLIERS.slice(0, 8).map((s) => ({
    supplier_id: s.supplier_id,
    supplier_name: s.supplier_name,
    tco2e: Math.round(1_843_200 * s.upstream_impact_pct / 100),
    spend_usd: s.supplier_revenue_usd_m * 1_000_000 * 0.003,
    intensity_tco2e_per_usd: s.supplier_intensity,
    data_quality: s.cee_rating === "A" ? "high" : s.cee_rating === "B" ? "medium" : "low",
    uncertainty: s.cee_rating === "D" ? "high" : s.cee_rating === "C" ? "medium" : "low",
    method: s.category.includes("Transport") ? "activity" : "spend",
    entity_type: "supplier_benchmark",
    entity_id: s.supplier_id,
  })),
  notes: {
    methodology: "Spend-based + activity-based. Factors applied by (method, category, region, year).",
    uncertainty_model: "Spend=high uncertainty; activity=medium; missing factors=low data quality.",
  },
};

// ───────────────────────────── Engagements ─────────────────────────────

const ENGAGEMENTS = [
  { supplier_id: "ppg_001", supplier_name: "PPG Industries", user_id: "demo_user", status: "in_progress", notes: "Initial meeting held. Sustainability team responsive.", next_action_date: "2026-03-15", created_at: WEEK_AGO, updated_at: DAY_AGO, history: [{ status: "not_started", notes: null, timestamp: WEEK_AGO }, { status: "in_progress", notes: "Initial meeting held.", timestamp: DAY_AGO }] },
  { supplier_id: "dow_001", supplier_name: "Dow Inc", user_id: "demo_user", status: "pending_response", notes: "Sent data request for Scope 1+2 breakdown.", next_action_date: "2026-03-01", created_at: WEEK_AGO, updated_at: DAY_AGO, history: [{ status: "not_started", notes: null, timestamp: WEEK_AGO }, { status: "pending_response", notes: "Data request sent.", timestamp: DAY_AGO }] },
  { supplier_id: "ups_001", supplier_name: "UPS Logistics", user_id: "demo_user", status: "not_started", notes: null, next_action_date: null, created_at: DAY_AGO, updated_at: DAY_AGO, history: [{ status: "not_started", notes: null, timestamp: DAY_AGO }] },
  { supplier_id: "basf_001", supplier_name: "BASF SE", user_id: "demo_user", status: "completed", notes: "Signed carbon reduction annex. 12% reduction target by 2027.", next_action_date: null, created_at: WEEK_AGO, updated_at: DAY_AGO, history: [{ status: "not_started", notes: null, timestamp: WEEK_AGO }, { status: "in_progress", notes: "Negotiations underway.", timestamp: WEEK_AGO }, { status: "completed", notes: "Signed carbon reduction annex.", timestamp: DAY_AGO }] },
  { supplier_id: "holcim_001", supplier_name: "Holcim Ltd", user_id: "demo_user", status: "in_progress", notes: "Reviewing low-carbon cement pilot proposal.", next_action_date: "2026-04-01", created_at: WEEK_AGO, updated_at: HOUR_AGO, history: [{ status: "not_started", notes: null, timestamp: WEEK_AGO }, { status: "in_progress", notes: "Pilot proposal under review.", timestamp: HOUR_AGO }] },
  { supplier_id: "schneider_001", supplier_name: "Schneider Electric", user_id: "demo_user", status: "completed", notes: "Already aligned on SBTi targets. Quarterly reporting in place.", next_action_date: null, created_at: WEEK_AGO, updated_at: WEEK_AGO, history: [{ status: "completed", notes: "Already SBTi-aligned.", timestamp: WEEK_AGO }] },
];

// ───────────────────────────── Heatmap ─────────────────────────────

const HEATMAP_DATA = SUPPLIERS.map((s) => ({
  supplier_name: s.supplier_name,
  category: s.category,
  intensity: s.supplier_intensity,
  upstream_impact_pct: s.upstream_impact_pct,
  potential_reduction_pct: s.potential_reduction_pct,
}));

// ───────────────────────────── Quality anomalies ─────────────────────────────

const ANOMALIES = [
  { id: "anom_001", rule_id: "provenance.missing.tco2e", subject_type: "supplier_benchmark", subject_id: "dow_001", subject_label: "Dow Inc", severity: "high", status: "open", message: "Missing provenance for tCO2e field on supplier benchmark.", fix_hint: "Upload evidence and link provenance for the tCO2e field.", details: { entity_type: "supplier_benchmark", entity_id: "dow_001", field_key: "tco2e", field_label: "Total CO2e" }, created_at: DAY_AGO, updated_at: DAY_AGO },
  { id: "anom_002", rule_id: "provenance.missing.spend_usd", subject_type: "supplier_benchmark", subject_id: "ups_001", subject_label: "UPS Logistics", severity: "high", status: "open", message: "Missing provenance for spend_usd field.", fix_hint: "Link purchase order or invoice evidence.", details: { entity_type: "supplier_benchmark", entity_id: "ups_001", field_key: "spend_usd", field_label: "Spend USD" }, created_at: DAY_AGO, updated_at: DAY_AGO },
  { id: "anom_003", rule_id: "provenance.missing.intensity", subject_type: "supplier_benchmark", subject_id: "arcelor_001", subject_label: "ArcelorMittal", severity: "high", status: "open", message: "Missing provenance for intensity field.", fix_hint: "Upload sustainability report and link intensity figure.", details: { entity_type: "supplier_benchmark", entity_id: "arcelor_001", field_key: "intensity", field_label: "Carbon Intensity" }, created_at: DAY_AGO, updated_at: DAY_AGO },
  { id: "anom_004", rule_id: "quality.low_data_quality", subject_type: "supplier_benchmark", subject_id: "holcim_001", subject_label: "Holcim Ltd", severity: "medium", status: "open", message: "Data quality rated 'low' — consider upgrading to activity-based method.", fix_hint: "Request activity data from supplier.", details: { entity_type: "supplier_benchmark", entity_id: "holcim_001", field_key: "data_quality" }, created_at: DAY_AGO, updated_at: DAY_AGO },
  { id: "anom_005", rule_id: "quality.low_data_quality", subject_type: "supplier_benchmark", subject_id: "ppg_001", subject_label: "PPG Industries", severity: "medium", status: "open", message: "Data quality rated 'low' — spend-based estimate only.", fix_hint: "Request actual emissions data.", details: { entity_type: "supplier_benchmark", entity_id: "ppg_001", field_key: "data_quality" }, created_at: DAY_AGO, updated_at: DAY_AGO },
  { id: "anom_006", rule_id: "provenance.missing.data_quality", subject_type: "supplier_benchmark", subject_id: "air_liquide_001", subject_label: "Air Liquide", severity: "medium", status: "open", message: "Missing provenance for data_quality field.", fix_hint: "Add provenance evidence for data_quality field.", details: { entity_type: "supplier_benchmark", entity_id: "air_liquide_001", field_key: "data_quality" }, created_at: DAY_AGO, updated_at: DAY_AGO },
  { id: "anom_007", rule_id: "evidence.insufficient_context", subject_type: "recommendation", subject_id: "dow_001", subject_label: "Dow Inc", severity: "medium", status: "open", message: "Recommendation lacks sufficient evidence context (< 3 chunks).", fix_hint: "Ingest more disclosure documents for this supplier.", details: { entity_type: "recommendation", entity_id: "dow_001" }, created_at: DAY_AGO, updated_at: DAY_AGO },
  { id: "anom_008", rule_id: "pipeline.stale_run", subject_type: "pipeline", subject_id: "last_run", subject_label: "Pipeline", severity: "low", status: "resolved", message: "Pipeline has not run in 7+ days.", fix_hint: "Trigger pipeline/run.", resolution_note: "Pipeline re-run completed.", details: {}, created_at: WEEK_AGO, updated_at: DAY_AGO },
  { id: "anom_009", rule_id: "engagement.no_action", subject_type: "engagement", subject_id: "ups_001", subject_label: "UPS Logistics", severity: "low", status: "open", message: "High-impact supplier (23.1%) has no engagement started.", fix_hint: "Begin supplier engagement.", details: { entity_type: "engagement", entity_id: "ups_001" }, created_at: DAY_AGO, updated_at: DAY_AGO },
  { id: "anom_010", rule_id: "provenance.missing.tco2e", subject_type: "supplier_benchmark", subject_id: "siemens_energy_001", subject_label: "Siemens Energy", severity: "medium", status: "ignored", message: "Missing provenance for tCO2e on Siemens Energy.", fix_hint: "Upload evidence.", resolution_note: "Deferred to next quarter.", details: { entity_type: "supplier_benchmark", entity_id: "siemens_energy_001", field_key: "tco2e" }, created_at: WEEK_AGO, updated_at: DAY_AGO },
];

// ───────────────────────────── Audit trail ─────────────────────────────

const AUDIT_EVENTS = [
  { id: "evt_001", user_id: "demo_user", action: "auth.login", meta: { provider: "demo" }, created_at: HOUR_AGO },
  { id: "evt_002", user_id: "demo_user", action: "pipeline.run", meta: { period: "last_12_months", status: "success" }, created_at: HOUR_AGO },
  { id: "evt_003", user_id: "demo_user", action: "measure.seed", meta: { purchases: 6, activities: 2, factors: 5 }, created_at: HOUR_AGO },
  { id: "evt_004", user_id: "demo_user", action: "engagement.update", meta: { supplier_id: "ppg_001", status: "in_progress" }, created_at: DAY_AGO },
  { id: "evt_005", user_id: "demo_user", action: "engagement.update", meta: { supplier_id: "basf_001", status: "completed" }, created_at: DAY_AGO },
  { id: "evt_006", user_id: "demo_user", action: "quality.scan", meta: { upserted: 10, scanned: 46 }, created_at: DAY_AGO },
  { id: "evt_007", user_id: "demo_user", action: "anomaly.resolve", meta: { anomaly_id: "anom_008", status: "resolved" }, created_at: DAY_AGO },
  { id: "evt_008", user_id: "demo_user", action: "provenance.create", meta: { entity_type: "supplier_benchmark", entity_id: "basf_001", field_key: "tco2e" }, created_at: WEEK_AGO },
  { id: "evt_009", user_id: "demo_user", action: "doc.upload", meta: { filename: "BASF_SR_2024.pdf", pages: 128 }, created_at: WEEK_AGO },
  { id: "evt_010", user_id: "demo_user", action: "period_lock.create", meta: { period: "last_12_months", status: "open" }, created_at: WEEK_AGO },
];

// ───────────────────────────── Evidence docs ─────────────────────────────

const DOCS = [
  { doc_id: "doc_basf_sr24", tenant_id: "demo_user", company_id: "basf", category: "ESG Disclosure", title: "BASF Sustainability Report 2024", filename: "BASF_SR_2024.pdf", size_bytes: 4_215_800, content_type: "pdf", sha256: "a1b2c3d4e5f6", source: "upload", uploaded_at: WEEK_AGO, created_at: WEEK_AGO, updated_at: WEEK_AGO },
  { doc_id: "doc_ppg_cdp23", tenant_id: "demo_user", company_id: "ppg", category: "CDP Response", title: "PPG Industries CDP Climate 2023", filename: "PPG_CDP_Climate_2023.pdf", size_bytes: 1_872_300, content_type: "pdf", sha256: "f6e5d4c3b2a1", source: "upload", uploaded_at: WEEK_AGO, created_at: WEEK_AGO, updated_at: WEEK_AGO },
  { doc_id: "doc_holcim_net0", tenant_id: "demo_user", company_id: "holcim", category: "Net Zero Plan", title: "Holcim Net Zero Roadmap 2030", filename: "Holcim_Net_Zero_Roadmap.pdf", size_bytes: 3_104_500, content_type: "pdf", sha256: "1a2b3c4d5e6f", source: "upload", uploaded_at: DAY_AGO, created_at: DAY_AGO, updated_at: DAY_AGO },
];

// ───────────────────────────── Deep-dive templates ─────────────────────────────

function makeDeepDive(s) {
  return {
    id: s.id,
    supplier_id: s.supplier_id,
    supplier_name: s.supplier_name,
    peer_id: s.peer_id,
    peer_name: s.peer_name,
    category: s.category,
    cee_rating: s.cee_rating,
    potential_reduction_pct: s.potential_reduction_pct,
    upstream_impact_pct: s.upstream_impact_pct,
    supplier_intensity: s.supplier_intensity,
    peer_intensity: s.peer_intensity,
    meta: {
      supplier_name: s.supplier_name,
      peer_name: s.peer_name,
      category: s.category,
    },
    metrics: {
      current_intensity: s.supplier_intensity * 1000,
      target_intensity: s.peer_intensity * 1000,
      reduction_potential_percentage: s.potential_reduction_pct,
    },
    content: {
      headline: `${s.supplier_name} can achieve a ${s.potential_reduction_pct}% reduction by aligning with peer ${s.peer_name}'s practices in ${s.category}.`,
      case_study_summary: `${s.peer_name} reduced Scope 1+2 intensity by ${Math.round(s.potential_reduction_pct * 0.6)}% over three years through operational efficiency, renewable energy procurement, and supply chain optimization. Their approach involved a phased rollout beginning with highest-emission facilities.`,
      action_plan: [
        { step: 1, title: "Supplier Engagement", detail: `Schedule sustainability review meeting with ${s.supplier_name}'s ESG team to discuss current emissions baseline and reduction targets.`, citation: "internal_analysis" },
        { step: 2, title: "Data Collection", detail: `Request Scope 1+2 breakdown, energy mix, and facility-level emissions data from ${s.supplier_name}.`, citation: `${s.peer_name.toLowerCase().replace(/\s/g, "_")}_sr_2024` },
        { step: 3, title: "Gap Analysis", detail: `Compare ${s.supplier_name}'s intensity (${(s.supplier_intensity * 1000).toFixed(1)} kgCO2e/unit) against ${s.peer_name}'s (${(s.peer_intensity * 1000).toFixed(1)} kgCO2e/unit) to identify specific improvement areas.`, citation: "peer_benchmarks" },
        { step: 4, title: "Pilot Program", detail: `Propose a 6-month pilot with ${s.supplier_name} targeting 10% of procurement volume to validate low-carbon alternatives.`, citation: "category_best_practices" },
      ],
      feasibility_timeline: s.potential_reduction_pct > 30 ? "18-24 months" : s.potential_reduction_pct > 20 ? "12-18 months" : "6-12 months",
      contract_clause: `SUPPLIER shall use commercially reasonable efforts to reduce the carbon intensity of Products supplied under this Agreement by at least ${Math.round(s.potential_reduction_pct * 0.5)}% within twenty-four (24) months from the Effective Date, measured against the baseline intensity of ${(s.supplier_intensity * 1000).toFixed(2)} kgCO2e per unit. SUPPLIER shall provide quarterly emissions reports conforming to the GHG Protocol Scope 3 Technical Guidance and shall make available supporting documentation for independent verification upon reasonable request.`,
      evidence_status: "ok",
    },
  };
}

// ───────────────────────────── Exports ─────────────────────────────

export const SEED = {
  // Auth
  authMe: { user_id: "demo_user", email: "demo@example.com", name: "Demo User", picture: null },
  authTestLogin: { user: { user_id: "demo_user", email: "demo@example.com", name: "Demo User", picture: null }, session_token: "demo_session_token" },

  // Measure
  measureSeed: { message: "Seeded measure data", purchases: 6, activities: 2, factors: 5 },
  measureOverview: MEASURE_OVERVIEW,

  // Pipeline
  pipelineRun: { message: "Pipeline run complete", run_id: "demo_run_001", note: "Seeded Measure + Reduce benchmarks + evidence chunks + cached recommendations." },
  pipelineSourcesSeed: { message: "Seeded sources", sources: 3, documents: 3 },
  pipelineIngest: { message: "Ingest complete", chunks: 9 },
  pipelineGenerate: { message: "Recommendations generated", count: 8 },

  // Suppliers
  suppliers: { suppliers: SUPPLIERS, total: SUPPLIERS.length },
  suppliersFilter: (params) => {
    let filtered = [...SUPPLIERS];
    if (params?.category) filtered = filtered.filter((s) => s.category === params.category);
    if (params?.rating) filtered = filtered.filter((s) => s.cee_rating === params.rating);
    if (params?.min_impact) filtered = filtered.filter((s) => s.upstream_impact_pct >= Number(params.min_impact));
    if (params?.min_reduction) filtered = filtered.filter((s) => s.potential_reduction_pct >= Number(params.min_reduction));
    return {
      suppliers: filtered,
      total: filtered.length,
      filters: { categories: CATEGORIES, ratings: RATINGS, applied: { category: params?.category || null, rating: params?.rating || null, min_impact: params?.min_impact || null, max_impact: null, min_reduction: params?.min_reduction || null } },
    };
  },
  suppliersHeatmap: { heatmap_data: HEATMAP_DATA },
  supplierDeepDive: (supplierId) => {
    const s = SUPPLIERS.find((x) => x.id === supplierId || x.supplier_id === supplierId);
    return s ? makeDeepDive(s) : { error: "Supplier not found" };
  },

  // Engagements
  engagements: { engagements: ENGAGEMENTS },
  engagementById: (supplierId) => {
    const e = ENGAGEMENTS.find((x) => x.supplier_id === supplierId);
    return e || { supplier_id: supplierId, user_id: "demo_user", status: "not_started", notes: null, next_action_date: null, created_at: NOW, updated_at: NOW, history: [{ status: "not_started", notes: null, timestamp: NOW }] };
  },

  // Quality
  anomalies: { anomalies: ANOMALIES },
  anomalyRun: { message: "Anomaly scan complete", upserted: 10 },

  // Audit
  audit: { events: AUDIT_EVENTS },
  metrics: { tenant_id: "demo_user", counts: { benchmarks: 12, recommendations: 8, sources: 3, docs: 3, chunks: 150 }, last_pipeline_run: { id: "demo_run_001", tenant_id: "demo_user", status: "success", started_at: HOUR_AGO, finished_at: HOUR_AGO } },

  // Evidence / docs
  docs: { docs: DOCS },
  documentPages: (docId) => ({
    pages: Array.from({ length: 3 }, (_, i) => ({
      id: `${docId}_page_${i + 1}`,
      doc_id: docId,
      page_number: i + 1,
      width: 612,
      height: 792,
      has_image: true,
      created_at: WEEK_AGO,
    })),
  }),
  ocrBlocks: (docId, pageNumber) => ({
    blocks: [
      { id: `block_${docId}_${pageNumber}_1`, doc_id: docId, page_number: Number(pageNumber), text: "Scope 3 GHG Emissions Summary", bbox: [72, 100, 400, 130], confidence: 0.97, created_at: WEEK_AGO },
      { id: `block_${docId}_${pageNumber}_2`, doc_id: docId, page_number: Number(pageNumber), text: "Total upstream emissions: 1,843,200 tCO2e", bbox: [72, 145, 450, 170], confidence: 0.95, created_at: WEEK_AGO },
      { id: `block_${docId}_${pageNumber}_3`, doc_id: docId, page_number: Number(pageNumber), text: "Coverage: 78.4% of Scope 3 categories", bbox: [72, 180, 420, 205], confidence: 0.96, created_at: WEEK_AGO },
    ],
  }),
  fieldProvenance: { provenance: [] },

  // Integrations
  integrationsCatalog: null, // Handled by integrationsClient.js built-in mock
  integrationsState: null,
};
