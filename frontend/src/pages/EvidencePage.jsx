import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageBboxOverlay from "@/components/PageBboxOverlay";

import { apiUrl } from "@/lib/api";
import {
  pickLatestOcrRequestBlocks,
  sortOcrBlocksDeterministic,
  sortSelectedIdsByBlocks,
} from "@/lib/provenance";

function parseIsoMs(iso) {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? t : 0;
}

function ImgFromB64({ b64 }) {
  const src = useMemo(() => {
    if (!b64) return null;
    return `data:image/png;base64,${b64}`;
  }, [b64]);

  if (!src) return null;
  return <img src={src} alt="Rendered PDF page" className="w-full rounded-md border border-white/10" />;
}

export default function EvidencePage() {
  const location = useLocation();

  const [docs, setDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCompanyId, setUploadCompanyId] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [rendered, setRendered] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [storedPage, setStoredPage] = useState(null);
  const [storedBlocks, setStoredBlocks] = useState([]);
  const [storedPages, setStoredPages] = useState([]);
  const [selectedStoredPageId, setSelectedStoredPageId] = useState("");
  const [showOverlay, setShowOverlay] = useState(true);
  const [storePage, setStorePage] = useState(true);
  const [selectedBlockIds, setSelectedBlockIds] = useState([]);
  const [blockQuery, setBlockQuery] = useState("");

  const [provEntityType, setProvEntityType] = useState("supplier_benchmark");
  const [provEntityId, setProvEntityId] = useState("");
  const [provFieldKey, setProvFieldKey] = useState("");
  const [provFieldLabel, setProvFieldLabel] = useState("");
  const [provValue, setProvValue] = useState("");
  const [provUnit, setProvUnit] = useState("");
  const [provNotes, setProvNotes] = useState("");
  const [provenanceRows, setProvenanceRows] = useState([]);
  const [selectedProvenanceId, setSelectedProvenanceId] = useState("");
  const [isLoadingProvenance, setIsLoadingProvenance] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const hash = (location.hash || "").replace("#", "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        // ignore
      }
    });
  }, [location.hash]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const entityType = params.get("entity_type");
    const entityId = params.get("entity_id");
    const fieldKey = params.get("field_key");
    const fieldLabel = params.get("field_label");
    const value = params.get("value");
    const unit = params.get("unit");

    if (entityType) setProvEntityType(entityType);
    if (entityId) setProvEntityId(entityId);
    if (fieldKey) setProvFieldKey(fieldKey);
    if (fieldLabel) setProvFieldLabel(fieldLabel);
    if (value) setProvValue(value);
    if (unit) setProvUnit(unit);
  }, [location.search]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(apiUrl("/pipeline/docs"), { withCredentials: true });
        setDocs(res.data.docs || []);
        if ((res.data.docs || []).length > 0) setSelectedDocId(res.data.docs[0].doc_id);
      } catch (e) {
        toast.error("Failed to load docs");
      }
    };
    load();
  }, []);

  const selectedDoc = useMemo(
    () => docs.find((d) => d.doc_id === selectedDocId) || null,
    [docs, selectedDocId]
  );

  const loadStoredPages = async (docId) => {
    if (!docId) return [];
    try {
      const res = await axios.get(apiUrl("/execution/document-pages"), {
        params: { doc_id: docId },
        withCredentials: true,
      });
      const pages = Array.isArray(res?.data?.pages) ? res.data.pages : [];
      setStoredPages(pages);
      return pages;
    } catch {
      setStoredPages([]);
      return [];
    }
  };

  const pickStoredPageId = (pages, pageNo) => {
    const n = Number(pageNo) || 1;
    const candidates = (pages || []).filter((p) => Number(p?.page_number) === n);
    if (candidates.length === 0) return "";
    candidates.sort((a, b) => {
      const za = Number(a?.zoom) || 0;
      const zb = Number(b?.zoom) || 0;
      if (za !== zb) return zb - za;
      const ia = String(a?.id || "");
      const ib = String(b?.id || "");
      if (ia < ib) return -1;
      if (ia > ib) return 1;
      return 0;
    });
    return String(candidates[0]?.id || "");
  };

  const loadStoredPageImage = async (pageId) => {
    if (!pageId) return null;
    const res = await axios.get(apiUrl("/execution/document-pages/image"), {
      params: { page_id: pageId, include_base64: true },
      withCredentials: true,
    });
    const img = res?.data?.image || null;
    const page = res?.data?.page || null;
    if (img?.png_base64) {
      setStoredPage(page);
      setRendered(img);
    }
    return { img, page };
  };

  const ensurePageImage = async ({ docId, pageNo }) => {
    const pages = await loadStoredPages(docId);
    const bestId = pickStoredPageId(pages, pageNo);
    if (bestId) {
      setSelectedStoredPageId(bestId);
      const got = await loadStoredPageImage(bestId);
      if (got?.img?.png_base64) return true;
    }

    const res = await axios.post(
      apiUrl("/execution/render-and-store-page"),
      { doc_id: docId, page_number: Number(pageNo), zoom: 2.0, return_image: true },
      { withCredentials: true }
    );
    setStoredPage(res.data.page || null);
    setRendered(res.data.image || null);
    if (res?.data?.page?.id) setSelectedStoredPageId(String(res.data.page.id));
    return Boolean(res?.data?.image?.png_base64);
  };

  const uploadPdf = async () => {
    if (!uploadFile) {
      toast.error("Pick a PDF to upload");
      return;
    }
    if (uploadFile.type && uploadFile.type !== "application/pdf") {
      toast.error("Only PDF files are supported");
      return;
    }

    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      if ((uploadTitle || "").trim()) fd.append("title", uploadTitle.trim());
      if ((uploadCompanyId || "").trim()) fd.append("company_id", uploadCompanyId.trim());
      if ((uploadCategory || "").trim()) fd.append("category", uploadCategory.trim());

      const res = await axios.post(apiUrl("/pipeline/docs/upload"), fd, { withCredentials: true });
      const returnedDoc = res?.data?.doc || null;

      if (returnedDoc?.doc_id) {
        setDocs((prev) => {
          const exists = (prev || []).some((d) => d.doc_id === returnedDoc.doc_id);
          return exists ? prev : [returnedDoc, ...(prev || [])];
        });
        setSelectedDocId(returnedDoc.doc_id);
      } else {
        const listRes = await axios.get(apiUrl("/pipeline/docs"), { withCredentials: true });
        const nextDocs = listRes.data.docs || [];
        setDocs(nextDocs);
        if (nextDocs.length > 0) setSelectedDocId(nextDocs[0].doc_id);
      }

      toast.success("Uploaded PDF");
      setUploadFile(null);
      setUploadTitle("");
      setUploadCompanyId("");
      setUploadCategory("");
      setUploadInputKey((k) => k + 1);
    } catch (e) {
      toast.error("Upload failed (check DOCSTORE_KEY and backend logs)");
    } finally {
      setIsUploading(false);
    }
  };

  const doRender = async () => {
    if (!selectedDocId) return;
    setIsLoading(true);
    setOcrResult(null);
    setStoredBlocks([]);
    setSelectedBlockIds([]);
    setSelectedStoredPageId("");
    try {
      if (storePage) {
        await ensurePageImage({ docId: selectedDocId, pageNo: pageNumber });
      } else {
        const res = await axios.post(
          apiUrl("/execution/render-pdf-page"),
          { doc_id: selectedDocId, page_number: Number(pageNumber), zoom: 2.0 },
          { withCredentials: true }
        );
        setStoredPage(null);
        setRendered(res.data);
      }
      toast.success("Rendered page");
    } catch (e) {
      toast.error("Render failed");
    } finally {
      setIsLoading(false);
    }
  };

  const doLoadStored = async () => {
    if (!selectedDocId) return;
    setIsLoading(true);
    setOcrResult(null);
    setStoredBlocks([]);
    setSelectedBlockIds([]);
    try {
      const pages = await loadStoredPages(selectedDocId);
      const bestId = pickStoredPageId(pages, pageNumber);
      if (!bestId) {
        toast.error("No stored render for that page (use Render)");
        return;
      }
      setSelectedStoredPageId(bestId);
      await loadStoredPageImage(bestId);
      toast.success("Loaded stored page");
    } catch {
      toast.error("Failed to load stored page");
    } finally {
      setIsLoading(false);
    }
  };

  const doLoadOcrBlocks = async (docIdArg, pageNoArg) => {
    const docId = docIdArg ?? selectedDocId;
    const pageNo = pageNoArg ?? pageNumber;
    if (!docId) return;
    setIsLoading(true);
    try {
      const blocksRes = await axios.get(apiUrl("/execution/ocr-blocks"), {
        params: { doc_id: docId, page_number: Number(pageNo) },
        withCredentials: true,
      });
      const all = blocksRes.data.blocks || [];
      const { blocks: picked } = pickLatestOcrRequestBlocks(all);
      setStoredBlocks(picked.slice(0, 2000));
      setSelectedBlockIds([]);
      toast.success(`Loaded OCR blocks (${picked.length})`);
    } catch {
      setStoredBlocks([]);
      toast.error("Failed to load OCR blocks");
    } finally {
      setIsLoading(false);
    }
  };

  const doOcr = async () => {
    if (!rendered?.png_base64) return;
    setIsLoading(true);
    try {
      const res = await axios.post(
        apiUrl("/execution/ocr"),
        {
          image_base64: rendered.png_base64,
          mime_type: "image/png",
          doc_id: selectedDocId,
          page_number: Number(pageNumber),
        },
        { withCredentials: true }
      );
      setOcrResult(res.data);
      setSelectedBlockIds([]);

      try {
        const blocksRes = await axios.get(apiUrl("/execution/ocr-blocks"), {
          params: { doc_id: selectedDocId, page_number: Number(pageNumber) },
          withCredentials: true,
        });
        const all = blocksRes.data.blocks || [];
        const filtered = res.data.request_id ? all.filter((b) => b.request_id === res.data.request_id) : all;
        setStoredBlocks(sortOcrBlocksDeterministic(filtered).slice(0, 2000));
      } catch {
        setStoredBlocks([]);
      }
      toast.success(`OCR complete (${(res.data.blocks || []).length} blocks)`);
    } catch (e) {
      toast.error("OCR failed");
    } finally {
      setIsLoading(false);
    }
  };

  const blocksForOverlay = useMemo(() => {
    if ((storedBlocks || []).length > 0) return storedBlocks;
    const tmp = (ocrResult?.blocks || []).map((b, idx) => {
      const bbox = Array.isArray(b?.bbox) ? b.bbox.map((n) => Number(n)) : [];
      const text = String(b?.text || "");
      const id = `tmp_${idx}_${String(bbox.join(","))}_${text.slice(0, 24)}`;
      return { ...b, id };
    });
    return sortOcrBlocksDeterministic(tmp);
  }, [ocrResult, storedBlocks]);

  const filteredBlocks = useMemo(() => {
    const q = (blockQuery || "").trim().toLowerCase();
    if (!q) return blocksForOverlay;
    return (blocksForOverlay || []).filter((b) => String(b?.text || "").toLowerCase().includes(q));
  }, [blocksForOverlay, blockQuery]);

  const toggleSelectBlock = (id) => {
    setSelectedBlockIds((prev) => {
      const set = new Set(prev || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  };

  const loadProvenance = async () => {
    if (!provEntityType || !provEntityId) {
      toast.error("Load provenance requires entity_type and entity_id");
      return;
    }
    setIsLoadingProvenance(true);
    try {
      const res = await axios.get(apiUrl("/execution/field-provenance"), {
        params: { entity_type: provEntityType, entity_id: provEntityId },
        withCredentials: true,
      });
      const rows = Array.isArray(res?.data?.provenance) ? res.data.provenance : [];
      rows.sort((a, b) => {
        const ta = parseIsoMs(a?.created_at);
        const tb = parseIsoMs(b?.created_at);
        if (ta !== tb) return tb - ta;
        const ia = String(a?.id || "");
        const ib = String(b?.id || "");
        if (ia < ib) return -1;
        if (ia > ib) return 1;
        return 0;
      });
      setProvenanceRows(rows);
    } catch {
      setProvenanceRows([]);
      toast.error("Failed to load provenance");
    } finally {
      setIsLoadingProvenance(false);
    }
  };

  const deleteProvenance = async (id) => {
    const pid = String(id || "");
    if (!pid) return;
    try {
      await axios.delete(apiUrl(`/execution/field-provenance/${pid}`), { withCredentials: true });
      setProvenanceRows((prev) => (prev || []).filter((r) => String(r?.id || "") !== pid));
      if (selectedProvenanceId === pid) setSelectedProvenanceId("");
      toast.success("Deleted provenance");
    } catch {
      toast.error("Failed to delete provenance");
    }
  };

  const viewProvenance = async (row) => {
    const docId = String(row?.doc_id || "");
    const pageNo = Number(row?.page_number) || 1;
    if (!docId || !pageNo) return;

    if (docId !== selectedDocId) {
      setSelectedDocId(docId);
      setStoredPages([]);
      setStoredBlocks([]);
      setOcrResult(null);
    }
    setPageNumber(pageNo);
    setSelectedProvenanceId(String(row?.id || ""));
    setSelectedBlockIds([]);

    setIsLoading(true);
    try {
      await ensurePageImage({ docId, pageNo });
      await doLoadOcrBlocks(docId, pageNo);
      toast.success("Navigated to provenance");
    } catch {
      toast.error("Failed to navigate to provenance");
    } finally {
      setIsLoading(false);
    }
  };

  const saveProvenance = async () => {
    if (!provEntityType || !provEntityId || !provFieldKey || !selectedDocId) {
      toast.error("Provenance requires entity_type, entity_id, field_key");
      return;
    }
    if ((selectedBlockIds || []).length === 0) {
      toast.error("Select at least one OCR block");
      return;
    }

    const sortedSelected = sortSelectedIdsByBlocks(selectedBlockIds, blocksForOverlay);
    const firstBlock = (blocksForOverlay || []).find((b) => (b?.id || "") === sortedSelected[0]) || null;
    const bbox = firstBlock?.bbox || null;

    try {
      await axios.post(
        apiUrl("/execution/field-provenance"),
        {
          entity_type: provEntityType,
          entity_id: provEntityId,
          field_key: provFieldKey,
          field_label: provFieldLabel || null,
          value: provValue || null,
          unit: provUnit || null,
          doc_id: selectedDocId,
          page_number: Number(pageNumber),
          bbox,
          ocr_block_ids: sortedSelected,
          ocr_request_id: ocrResult?.request_id || null,
          notes: provNotes || null,
        },
        { withCredentials: true }
      );
      toast.success("Saved provenance");
      setProvNotes("");
      await loadProvenance();
    } catch {
      toast.error("Failed to save provenance");
    }
  };

  const provenanceHighlights = useMemo(() => {
    const docId = String(selectedDocId || "");
    const pageNo = Number(pageNumber) || 1;
    const fieldKey = String(provFieldKey || "").trim();
    const rows = (provenanceRows || []).filter(
      (r) => String(r?.doc_id || "") === docId && Number(r?.page_number) === pageNo
    );
    const filtered = fieldKey ? rows.filter((r) => String(r?.field_key || "") === fieldKey) : rows;
    const selectedId = String(selectedProvenanceId || "");

    const mapped = filtered
      .map((r) => ({
        id: String(r?.id || ""),
        bbox: r?.bbox || null,
        kind: "provenance",
        selected: String(r?.id || "") === selectedId,
      }))
      .filter((h) => Array.isArray(h?.bbox) && h.bbox.length === 4);

    mapped.sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
    return mapped;
  }, [pageNumber, provFieldKey, provenanceRows, selectedDocId, selectedProvenanceId]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white ml-64 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight">Evidence</h1>
          <p className="text-sm sm:text-base text-gray-400 mt-2">
            Render a disclosure PDF page and run Gemini Flash OCR to extract blocks (text + bboxes).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-[#121212] border-white/10 p-4 lg:col-span-1">
            <div className="space-y-4">
              <div id="upload" className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Upload PDF</div>
                <input
                  key={uploadInputKey}
                  className="w-full text-xs text-gray-300"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs col-span-2"
                    placeholder="title (optional)"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs"
                    placeholder="company_id (optional)"
                    value={uploadCompanyId}
                    onChange={(e) => setUploadCompanyId(e.target.value)}
                  />
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs"
                    placeholder="category (optional)"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full mt-2 bg-[#22C55E] hover:bg-[#16A34A] text-black"
                  onClick={uploadPdf}
                  disabled={!uploadFile || isUploading}
                >
                  {isUploading ? "Uploading…" : "Upload"}
                </Button>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Document</div>
                <Select value={selectedDocId || ""} onValueChange={setSelectedDocId}>
                  <SelectTrigger className="bg-[#0A0A0A] border-white/10">
                    <SelectValue placeholder="Select a doc" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121212] border-white/10">
                    {docs.map((d) => (
                      <SelectItem key={d.doc_id} value={d.doc_id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDoc && (
                  <div className="text-xs text-gray-500 mt-2 break-all">URL: {selectedDoc.url}</div>
                )}
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Page Number</div>
                <input
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-sm"
                  type="number"
                  min={1}
                  value={pageNumber}
                  onChange={(e) => setPageNumber(e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Tip: seeded docs contain pages like 45 (Sika), 12 (DHL), 88 (BASF).
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={storePage}
                    onChange={(e) => setStorePage(e.target.checked)}
                    className="accent-[#22C55E]"
                  />
                  Store rendered page
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={showOverlay}
                    onChange={(e) => setShowOverlay(e.target.checked)}
                    className="accent-[#22C55E]"
                    disabled={!rendered?.png_base64}
                  />
                  Show bboxes
                </label>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-black"
                  onClick={doRender}
                  disabled={!selectedDocId || isLoading}
                >
                  Render
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={doOcr}
                  disabled={!rendered?.png_base64 || isLoading}
                >
                  OCR
                </Button>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={doLoadStored} disabled={!selectedDocId || isLoading}>
                  Load stored
                </Button>
                <Button className="flex-1" variant="outline" onClick={doLoadOcrBlocks} disabled={!selectedDocId || isLoading}>
                  Load blocks
                </Button>
              </div>

              {ocrResult && (
                <div className="text-xs text-gray-400">
                  Stored blocks in Mongo: <span className="text-white">ocr_blocks</span>
                </div>
              )}

              {storedPage?.id && (
                <div className="text-xs text-gray-500 break-all">
                  Stored page: <span className="text-white">{storedPage.id}</span>
                </div>
              )}

              {(storedPages || []).length > 0 ? (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Stored Render</div>
                  <Select value={selectedStoredPageId || ""} onValueChange={(v) => setSelectedStoredPageId(v)}>
                    <SelectTrigger className="bg-[#0A0A0A] border-white/10">
                      <SelectValue placeholder="Select stored page" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-white/10">
                      {(storedPages || []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          p{p.page_number} z{p.zoom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full mt-2"
                    variant="secondary"
                    onClick={() => loadStoredPageImage(selectedStoredPageId)}
                    disabled={!selectedStoredPageId || isLoading}
                  >
                    Load selected stored
                  </Button>
                </div>
              ) : null}

              <div className="pt-2 border-t border-white/10">
                <div id="provenance" className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Field Provenance
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs"
                    placeholder="entity_type (e.g., supplier_benchmark)"
                    value={provEntityType}
                    onChange={(e) => setProvEntityType(e.target.value)}
                  />
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs"
                    placeholder="entity_id"
                    value={provEntityId}
                    onChange={(e) => setProvEntityId(e.target.value)}
                  />
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs"
                    placeholder="field_key"
                    value={provFieldKey}
                    onChange={(e) => setProvFieldKey(e.target.value)}
                  />
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs"
                    placeholder="field_label (optional)"
                    value={provFieldLabel}
                    onChange={(e) => setProvFieldLabel(e.target.value)}
                  />
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs col-span-2"
                    placeholder="value (optional)"
                    value={provValue}
                    onChange={(e) => setProvValue(e.target.value)}
                  />
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs"
                    placeholder="unit (optional)"
                    value={provUnit}
                    onChange={(e) => setProvUnit(e.target.value)}
                  />
                  <input
                    className="bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs"
                    placeholder="notes (optional)"
                    value={provNotes}
                    onChange={(e) => setProvNotes(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>Selected blocks: {(selectedBlockIds || []).length}</span>
                  <Button
                    className="h-8 px-3 bg-[#22C55E] hover:bg-[#16A34A] text-black"
                    onClick={saveProvenance}
                    disabled={isLoading}
                  >
                    Save
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>Existing provenance: {(provenanceRows || []).length}</span>
                  <Button className="h-8 px-3" variant="outline" onClick={loadProvenance} disabled={isLoadingProvenance}>
                    {isLoadingProvenance ? "Loading…" : "Refresh"}
                  </Button>
                </div>
                <div className="mt-2 max-h-[180px] overflow-auto rounded-md border border-white/10">
                  {(provenanceRows || []).length === 0 ? (
                    <div className="text-xs text-gray-500 p-2">No provenance loaded.</div>
                  ) : (
                    (provenanceRows || []).slice(0, 200).map((r) => {
                      const id = String(r?.id || "");
                      const isSel = id && id === String(selectedProvenanceId || "");
                      const matchesField = provFieldKey && String(r?.field_key || "") === String(provFieldKey);
                      return (
                        <div
                          key={id}
                          className={[
                            "flex items-center justify-between gap-2 p-2 border-b border-white/5",
                            isSel ? "bg-white/5" : "",
                          ].join(" ")}
                        >
                          <button
                            type="button"
                            className="flex-1 text-left"
                            onClick={() => {
                              setSelectedProvenanceId(id);
                              if (matchesField && Array.isArray(r?.ocr_block_ids) && r.ocr_block_ids.length > 0) {
                                setSelectedBlockIds(r.ocr_block_ids.map((x) => String(x)));
                              }
                            }}
                            title={String(r?.notes || "")}
                          >
                            <div className="text-xs text-gray-200 truncate">
                              {r.field_key} {r.value != null ? `= ${r.value}` : ""} {r.unit ? `(${r.unit})` : ""}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono truncate">
                              doc {String(r.doc_id || "").slice(0, 10)}… p{r.page_number}{" "}
                              {r.created_at ? String(r.created_at).slice(0, 19).replace("T", " ") : ""}
                            </div>
                          </button>
                          <div className="flex gap-2">
                            <Button className="h-7 px-2" variant="secondary" onClick={() => viewProvenance(r)} disabled={isLoading}>
                              View
                            </Button>
                            <Button className="h-7 px-2" variant="outline" onClick={() => deleteProvenance(id)} disabled={isLoading}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-[#121212] border-white/10 p-4 lg:col-span-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Rendered Page</div>
                <ScrollArea className="h-[520px] rounded-md">
                  <div className="pr-4">
                    {showOverlay ? (
                      <PageBboxOverlay
                        pngBase64={rendered?.png_base64}
                        imageWidth={rendered?.width}
                        imageHeight={rendered?.height}
                        blocks={blocksForOverlay}
                        selectedIds={selectedBlockIds}
                        onToggleSelect={toggleSelectBlock}
                        highlights={provenanceHighlights}
                      />
                    ) : (
                      <ImgFromB64 b64={rendered?.png_base64} />
                    )}
                  </div>
                </ScrollArea>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">OCR Blocks</div>
                <input
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-2 text-xs mb-2"
                  placeholder="Search blocks…"
                  value={blockQuery}
                  onChange={(e) => setBlockQuery(e.target.value)}
                />
                <ScrollArea className="h-[484px] rounded-md border border-white/10 bg-[#0A0A0A]">
                  <div className="p-2 space-y-1">
                    {(filteredBlocks || []).length === 0 ? (
                      <div className="text-xs text-gray-500 p-2">
                        {blocksForOverlay?.length ? "No matches." : "Run OCR / Load blocks to see text blocks."}
                      </div>
                    ) : (
                      (filteredBlocks || []).slice(0, 500).map((b, idx) => {
                        const id = String(b?.id || `tmp_${idx}`);
                        const isSel = (selectedBlockIds || []).includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            className={[
                              "w-full text-left rounded-md border px-2 py-1 transition-colors",
                              isSel ? "border-[#22C55E] bg-[#22C55E]/10" : "border-white/10 hover:bg-white/5",
                            ].join(" ")}
                            onClick={() => toggleSelectBlock(id)}
                            title={String(b?.text || "")}
                          >
                            <div className="text-xs text-gray-200 line-clamp-3">{String(b?.text || "")}</div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {Array.isArray(b?.bbox) && b.bbox.length === 4
                                ? `bbox [${b.bbox.map((n) => Math.round(Number(n) || 0)).join(", ")}]`
                                : "bbox —"}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
