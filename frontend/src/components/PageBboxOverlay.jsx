import { useMemo } from "react";

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function bboxToStyle(bbox, imgW, imgH) {
  const x0 = Number(bbox?.[0] ?? 0);
  const y0 = Number(bbox?.[1] ?? 0);
  const x1 = Number(bbox?.[2] ?? 0);
  const y1 = Number(bbox?.[3] ?? 0);

  const left = clamp01(imgW > 0 ? x0 / imgW : 0) * 100;
  const top = clamp01(imgH > 0 ? y0 / imgH : 0) * 100;
  const width = clamp01(imgW > 0 ? (x1 - x0) / imgW : 0) * 100;
  const height = clamp01(imgH > 0 ? (y1 - y0) / imgH : 0) * 100;
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };
}

export default function PageBboxOverlay({
  pngBase64,
  imageWidth,
  imageHeight,
  blocks,
  selectedIds,
  onToggleSelect,
  highlights,
}) {
  const src = useMemo(() => {
    if (!pngBase64) return null;
    return `data:image/png;base64,${pngBase64}`;
  }, [pngBase64]);

  if (!src) return null;

  const selected = new Set(selectedIds || []);

  return (
    <div className="relative w-full">
      <img src={src} alt="Rendered PDF page" className="w-full rounded-md border border-white/10 select-none" />

      <div className="absolute inset-0">
        {(highlights || []).map((h, idx) => {
          const id = String(h?.id || `highlight_${idx}`);
          const bbox = h?.bbox || [];
          const style = bboxToStyle(bbox, Number(imageWidth) || 0, Number(imageHeight) || 0);
          const hasBox = bbox.length === 4;
          if (!hasBox) return null;
          return (
            <div
              key={id}
              className={[
                "absolute rounded-sm border pointer-events-none",
                h?.kind === "provenance" ? "border-amber-400/90 bg-amber-400/10" : "border-white/40 bg-white/5",
                h?.selected ? "ring-2 ring-amber-300/60" : "",
              ].join(" ")}
              style={style}
            />
          );
        })}
        {(blocks || []).map((b, idx) => {
          const id = b?.id || `tmp_${idx}`;
          const bbox = b?.bbox || [];
          const isSelected = selected.has(id);
          const style = bboxToStyle(bbox, Number(imageWidth) || 0, Number(imageHeight) || 0);
          const hasBox = bbox.length === 4;

          if (!hasBox) return null;

          return (
            <button
              key={id}
              type="button"
              title={(b?.text || "").slice(0, 200)}
              onClick={() => (onToggleSelect ? onToggleSelect(id) : null)}
              className={[
                "absolute rounded-sm border transition-colors",
                isSelected
                  ? "border-[#22C55E] bg-[#22C55E]/15"
                  : "border-sky-400/70 bg-sky-400/5 hover:bg-sky-400/10",
              ].join(" ")}
              style={style}
            />
          );
        })}
      </div>
    </div>
  );
}
