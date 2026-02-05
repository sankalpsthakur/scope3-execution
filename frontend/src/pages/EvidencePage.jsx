import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function ImgFromB64({ b64 }) {
  const src = useMemo(() => {
    if (!b64) return null;
    return `data:image/png;base64,${b64}`;
  }, [b64]);

  if (!src) return null;
  return <img src={src} alt="Rendered PDF page" className="w-full rounded-md border border-white/10" />;
}

export default function EvidencePage() {
  const [docs, setDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [rendered, setRendered] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/pipeline/docs`, { withCredentials: true });
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

  const doRender = async () => {
    if (!selectedDocId) return;
    setIsLoading(true);
    setOcrResult(null);
    try {
      const res = await axios.post(
        `${API}/execution/render-pdf-page`,
        { doc_id: selectedDocId, page_number: Number(pageNumber), zoom: 2.0 },
        { withCredentials: true }
      );
      setRendered(res.data);
      toast.success("Rendered page");
    } catch (e) {
      toast.error("Render failed");
    } finally {
      setIsLoading(false);
    }
  };

  const doOcr = async () => {
    if (!rendered?.png_base64) return;
    setIsLoading(true);
    try {
      const res = await axios.post(
        `${API}/execution/ocr`,
        {
          image_base64: rendered.png_base64,
          mime_type: "image/png",
          doc_id: selectedDocId,
          page_number: Number(pageNumber),
        },
        { withCredentials: true }
      );
      setOcrResult(res.data);
      toast.success(`OCR complete (${(res.data.blocks || []).length} blocks)`);
    } catch (e) {
      toast.error("OCR failed");
    } finally {
      setIsLoading(false);
    }
  };

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

              {ocrResult && (
                <div className="text-xs text-gray-400">
                  Stored blocks in Mongo: <span className="text-white">ocr_blocks</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-[#121212] border-white/10 p-4 lg:col-span-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Rendered Page</div>
                <ScrollArea className="h-[520px] rounded-md">
                  <div className="pr-4">
                    <ImgFromB64 b64={rendered?.png_base64} />
                  </div>
                </ScrollArea>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">OCR Output</div>
                <ScrollArea className="h-[520px] rounded-md border border-white/10 bg-[#0A0A0A]">
                  <pre className="text-xs text-gray-200 p-3 whitespace-pre-wrap break-words">
                    {ocrResult ? JSON.stringify(ocrResult, null, 2) : "Run OCR to see blocks + raw_text"}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
