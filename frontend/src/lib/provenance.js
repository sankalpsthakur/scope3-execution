function numOrNull(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

export function bboxSortKey(bbox) {
  const x0 = numOrNull(bbox?.[0]);
  const y0 = numOrNull(bbox?.[1]);
  const x1 = numOrNull(bbox?.[2]);
  const y1 = numOrNull(bbox?.[3]);
  const ok = x0 != null && y0 != null && x1 != null && y1 != null;
  if (!ok) return { has: 0, y0: 0, x0: 0, y1: 0, x1: 0, area: 0 };
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);
  return { has: 1, y0, x0, y1, x1, area: w * h };
}

export function sortOcrBlocksDeterministic(blocks) {
  const arr = Array.isArray(blocks) ? [...blocks] : [];
  arr.sort((a, b) => {
    const ka = bboxSortKey(a?.bbox);
    const kb = bboxSortKey(b?.bbox);

    if (ka.has !== kb.has) return kb.has - ka.has;
    if (ka.y0 !== kb.y0) return ka.y0 - kb.y0;
    if (ka.x0 !== kb.x0) return ka.x0 - kb.x0;
    if (ka.y1 !== kb.y1) return ka.y1 - kb.y1;
    if (ka.x1 !== kb.x1) return ka.x1 - kb.x1;
    if (ka.area !== kb.area) return ka.area - kb.area;

    const ida = String(a?.id ?? "");
    const idb = String(b?.id ?? "");
    if (ida < idb) return -1;
    if (ida > idb) return 1;

    const ta = String(a?.text ?? "");
    const tb = String(b?.text ?? "");
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return 0;
  });
  return arr;
}

function timeMs(iso) {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? t : 0;
}

export function pickLatestOcrRequestBlocks(blocks) {
  const arr = Array.isArray(blocks) ? blocks : [];
  if (arr.length === 0) return { blocks: [], requestId: null };

  const byReq = new Map();
  for (const b of arr) {
    const requestId = String(b?.request_id || "");
    if (!requestId) continue;
    const createdAt = timeMs(b?.created_at);
    const prev = byReq.get(requestId);
    if (!prev || createdAt > prev.createdAt) byReq.set(requestId, { createdAt });
  }

  let latestRequestId = null;
  let latestCreatedAt = -1;
  for (const [requestId, info] of byReq.entries()) {
    if (info.createdAt > latestCreatedAt) {
      latestCreatedAt = info.createdAt;
      latestRequestId = requestId;
    }
  }

  if (!latestRequestId) return { blocks: sortOcrBlocksDeterministic(arr), requestId: null };
  const filtered = arr.filter((b) => String(b?.request_id || "") === latestRequestId);
  return { blocks: sortOcrBlocksDeterministic(filtered), requestId: latestRequestId };
}

export function sortSelectedIdsByBlocks(selectedIds, blocks) {
  const ids = Array.isArray(selectedIds) ? selectedIds : [];
  const set = new Set(ids.map((x) => String(x)));
  const order = new Map();
  (Array.isArray(blocks) ? blocks : []).forEach((b, idx) => {
    const id = String(b?.id || "");
    if (id) order.set(id, idx);
  });

  return Array.from(set).sort((a, b) => {
    const ia = order.has(a) ? order.get(a) : Number.MAX_SAFE_INTEGER;
    const ib = order.has(b) ? order.get(b) : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}

