const STORAGE_KEY = "scope3.mock.vendor_outreach.v1";

function nowIso() {
  return new Date().toISOString();
}

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function readAll() {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY) || "[]");
}

function writeAll(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows || []));
}

function makeId() {
  return `outreach_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function seedIfEmpty() {
  const rows = readAll();
  if (rows.length) return rows;
  const seeded = [
    {
      id: makeId(),
      supplier_name: "International Paper",
      supplier_email: "sustainability@internationalpaper.example",
      channel: { type: "connector", connector_id: "ariba_network", label: "Ariba Network" },
      status: "invited",
      reminders: 0,
      evidence_requests: [],
      timeline: [{ at: nowIso(), action: "invite_sent", detail: "Invite sent to supplier portal contact." }],
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: makeId(),
      supplier_name: "UPS Logistics",
      supplier_email: "ops@ups-logistics.example",
      channel: { type: "email", connector_id: "email_sftp", label: "Email / SFTP Drop" },
      status: "evidence_requested",
      reminders: 1,
      evidence_requests: [
        {
          id: makeId(),
          type: "PCF",
          message: "Please share a product carbon footprint (PCF) for top SKUs and methodology notes.",
          due_date: "2026-03-01",
          status: "requested",
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
      timeline: [
        { at: nowIso(), action: "invite_sent", detail: "Intro email sent to supplier contact." },
        { at: nowIso(), action: "evidence_requested", detail: "Requested PCF evidence with due date." },
      ],
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];
  writeAll(seeded);
  return seeded;
}

function updateRow(id, mutateFn) {
  const all = readAll();
  const next = all.map((r) => {
    if (r.id !== id) return r;
    const updated = mutateFn({ ...r });
    return { ...updated, updated_at: nowIso() };
  });
  writeAll(next);
  return next;
}

export const outreachClient = {
  list: async () => {
    const rows = seedIfEmpty();
    return { outreach: rows };
  },

  inviteSupplier: async ({ supplier_name, supplier_email, channel }) => {
    const all = seedIfEmpty();
    const row = {
      id: makeId(),
      supplier_name,
      supplier_email,
      channel,
      status: "invited",
      reminders: 0,
      evidence_requests: [],
      timeline: [{ at: nowIso(), action: "invite_sent", detail: "Invite sent." }],
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    writeAll([row, ...all]);
    return { outreach: row };
  },

  requestEvidence: async ({ outreach_id, type, message, due_date }) => {
    const req = {
      id: makeId(),
      type,
      message,
      due_date,
      status: "requested",
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    const next = updateRow(outreach_id, (r) => {
      const evidence_requests = [req, ...(r.evidence_requests || [])];
      const timeline = [
        { at: nowIso(), action: "evidence_requested", detail: `${type} requested${due_date ? ` (due ${due_date})` : ""}.` },
        ...(r.timeline || []),
      ];
      return { ...r, status: "evidence_requested", evidence_requests, timeline };
    });
    const row = next.find((r) => r.id === outreach_id) || null;
    return { outreach: row, request: req };
  },

  markEvidenceReceived: async ({ outreach_id, request_id }) => {
    const next = updateRow(outreach_id, (r) => {
      const evidence_requests = (r.evidence_requests || []).map((e) =>
        e.id === request_id ? { ...e, status: "received", updated_at: nowIso() } : e
      );
      const timeline = [
        { at: nowIso(), action: "evidence_received", detail: "Supplier submitted evidence." },
        ...(r.timeline || []),
      ];
      return { ...r, status: "evidence_received", evidence_requests, timeline };
    });
    const row = next.find((r) => r.id === outreach_id) || null;
    return { outreach: row };
  },

  verify: async ({ outreach_id }) => {
    const next = updateRow(outreach_id, (r) => {
      const timeline = [{ at: nowIso(), action: "verified", detail: "Evidence verified and accepted." }, ...(r.timeline || [])];
      return { ...r, status: "verified", timeline };
    });
    const row = next.find((r) => r.id === outreach_id) || null;
    return { outreach: row };
  },

  remind: async ({ outreach_id }) => {
    const next = updateRow(outreach_id, (r) => {
      const reminders = (r.reminders || 0) + 1;
      const timeline = [{ at: nowIso(), action: "reminder_sent", detail: "Reminder sent to supplier." }, ...(r.timeline || [])];
      return { ...r, reminders, timeline };
    });
    const row = next.find((r) => r.id === outreach_id) || null;
    return { outreach: row };
  },
};

