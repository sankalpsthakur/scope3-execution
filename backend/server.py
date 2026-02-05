from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import secrets
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
import math
import re
import hashlib
import base64
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from cryptography.fernet import Fernet
from apscheduler.triggers.cron import CronTrigger
from pypdf import PdfReader
import fitz  # PyMuPDF
from typing import List, Optional, Dict, Any, Tuple
import uuid
from datetime import datetime, timezone, timedelta
import httpx

from fastapi.responses import StreamingResponse
from io import BytesIO
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

scheduler: Optional[AsyncIOScheduler] = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ==================== COOKIE HELPERS ====================

def _cookie_settings_for_request(request: Request) -> Dict[str, Any]:
    """Choose cookie flags based on environment.

    - Production/browser cross-site XHR: requires SameSite=None + Secure.
    - Local dev over http://localhost:3000 -> http://localhost:8000: must NOT be Secure; use SameSite=Lax.
    """
    host = (request.url.hostname or "").lower()
    scheme = (request.url.scheme or "").lower()

    is_localhost = host in {"localhost", "127.0.0.1"} or host.endswith(".localhost")
    is_http = scheme == "http"

    if is_localhost and is_http:
        return {"secure": False, "samesite": "lax"}
    return {"secure": True, "samesite": "none"}

# ==================== INTEGRATIONS (DEMO CATALOG) ====================

INTEGRATIONS_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "sap_ariba",
        "name": "SAP Ariba (Buying & Invoicing)",
        "category": "Procure-to-Pay",
        "auth": "OAuth / API",
        "objects": ["suppliers", "purchase_orders", "invoices", "spend_categories"],
        "notes": "Popular procurement network + P2P suite. Demo seeds invoice/spend lines into Measure.",
    },
    {
        "id": "coupa",
        "name": "Coupa",
        "category": "Procure-to-Pay",
        "auth": "API key",
        "objects": ["suppliers", "invoices", "spend", "categories"],
        "notes": "Common P2P for mid/enterprise procurement. Demo seeds spend lines.",
    },
    {
        "id": "oracle_fusion",
        "name": "Oracle Fusion ERP",
        "category": "ERP",
        "auth": "OAuth / API",
        "objects": ["gl", "ap_invoices", "vendors", "cost_centers"],
        "notes": "Finance-led ERP source of truth for spend and AP.",
    },
    {
        "id": "netsuite",
        "name": "Oracle NetSuite",
        "category": "ERP",
        "auth": "Token-based",
        "objects": ["gl", "ap_invoices", "vendors"],
        "notes": "Common in high-growth and multi-subsidiary orgs.",
    },
    {
        "id": "workday_financials",
        "name": "Workday Financials",
        "category": "ERP",
        "auth": "OAuth / API",
        "objects": ["suppliers", "invoices", "spend", "org_units"],
        "notes": "Often paired with Workday HCM; finance + supplier master data.",
    },
    {
        "id": "d365_finance",
        "name": "Microsoft Dynamics 365 Finance",
        "category": "ERP",
        "auth": "OAuth / API",
        "objects": ["gl", "ap_invoices", "vendors"],
        "notes": "Common in enterprise Microsoft stacks.",
    },
    {
        "id": "sap_concur",
        "name": "SAP Concur (Travel & Expense)",
        "category": "Travel",
        "auth": "OAuth / API",
        "objects": ["expenses", "trips", "air", "hotel", "rail"],
        "notes": "Scope 3 Cat 6 (business travel) and employee spend signals.",
    },
    {
        "id": "project44",
        "name": "project44 (Logistics Visibility)",
        "category": "Logistics",
        "auth": "API key",
        "objects": ["shipments", "legs", "modes", "weights", "distances"],
        "notes": "Shipment activity data for Cat 4/9; demo seeds tonne-km.",
    },
    {
        "id": "ecovadis",
        "name": "EcoVadis",
        "category": "Vendor ESG",
        "auth": "API key",
        "objects": ["supplier_scorecards", "risk_flags"],
        "notes": "Supplier ESG signals and remediation workflows (non-numeric).",
    },
    {
        "id": "ariba_network",
        "name": "Ariba Network (Supplier Portal)",
        "category": "Vendor Portals",
        "auth": "Portal + API",
        "objects": ["supplier_invites", "messages", "documents"],
        "notes": "Supplier-side portal workflows for invites + document exchange.",
    },
    {
        "id": "coupa_supplier_portal",
        "name": "Coupa Supplier Portal",
        "category": "Vendor Portals",
        "auth": "Portal + API",
        "objects": ["supplier_invites", "questionnaires", "documents"],
        "notes": "Supplier portal for structured ESG questionnaires + evidence collection.",
    },
    {
        "id": "tradeshift",
        "name": "Tradeshift",
        "category": "Vendor Portals",
        "auth": "OAuth / API",
        "objects": ["supplier_profiles", "messages", "documents"],
        "notes": "Network + invoicing portal; use as vendor outreach channel in demo flows.",
    },
    {
        "id": "basware",
        "name": "Basware Network",
        "category": "Vendor Portals",
        "auth": "OAuth / API",
        "objects": ["suppliers", "messages", "documents"],
        "notes": "Invoice-to-pay network with supplier participation tracking.",
    },
    {
        "id": "tungsten",
        "name": "Tungsten Network",
        "category": "Vendor Portals",
        "auth": "OAuth / API",
        "objects": ["suppliers", "messages", "documents"],
        "notes": "Invoice network; usable as a vendor outreach channel for evidence requests.",
    },
    {
        "id": "ivalua",
        "name": "Ivalua",
        "category": "Vendor Portals",
        "auth": "OAuth / API",
        "objects": ["suppliers", "questionnaires", "documents"],
        "notes": "SRM + sourcing suite; questionnaires are useful for ESG data collection.",
    },
    {
        "id": "gepsmart",
        "name": "GEP SMART",
        "category": "Vendor Portals",
        "auth": "OAuth / API",
        "objects": ["suppliers", "events", "questionnaires"],
        "notes": "Procurement suite; good fit for structured supplier ESG requests.",
    },
    {
        "id": "sftp_csv",
        "name": "SFTP / CSV Feed",
        "category": "File Feeds",
        "auth": "SSH key",
        "objects": ["gl_extracts", "invoice_feeds", "meter_reads"],
        "notes": "Always-on enterprise fallback. Demo seeds spend + electricity kWh.",
    },
]


# ==================== MODELS ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SupplierBenchmark(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Tech spec identifiers
    supplier_id: str
    supplier_name: str
    peer_id: str
    peer_name: str

    # Dashboard columns
    category: str
    cee_rating: str
    potential_reduction_pct: float
    upstream_impact_pct: float

    # Deep dive metrics
    supplier_intensity: float
    peer_intensity: float

    # Peer matching explainability fields
    isic_code: Optional[str] = None
    industry_sector: Optional[str] = None
    supplier_revenue_usd_m: Optional[float] = None
    peer_revenue_usd_m: Optional[float] = None
    revenue_band: Optional[str] = None
    comparison_year: Optional[str] = None

    # Mock “spend” fields to support edge cases
    upstream_spend_usd_m: Optional[float] = None


class ActionStep(BaseModel):
    step: int
    title: str
    detail: str
    citation: Optional[str] = None


class EngagementUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
    next_action_date: Optional[str] = None


# ==================== AUTH ENDPOINTS (Emergent-managed Google Auth) ====================

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Process session_id from Emergent Auth and create local session"""
    try:
        body = await request.json()
        session_id = body.get("session_id")

        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")

        async with httpx.AsyncClient() as client_http:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            )

            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")

            user_data = auth_response.json()

        existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})

        if existing_user:
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "name": user_data["name"],
                        "picture": user_data.get("picture"),
                    }
                },
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.insert_one(
                {
                    "user_id": user_id,
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "picture": user_data.get("picture"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )

        session_token = user_data.get("session_token", f"session_{uuid.uuid4().hex}")
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        await db.user_sessions.insert_one(
            {
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        cookie_settings = _cookie_settings_for_request(request)
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=bool(cookie_settings["secure"]),
            samesite=str(cookie_settings["samesite"]),
            path="/",
            max_age=7 * 24 * 60 * 60,
        )

        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        await _log_audit(user_id, "auth.login", {"provider": "emergent_google"})
        return {"user": user_doc, "session_token": session_token}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/auth/test-login")
async def test_login(request: Request, response: Response):
    """DEV/TEST ONLY: deterministic auth for automated E2E.

    Guarded by:
    - TEST_MODE=true
    - X-Test-Auth header matches TEST_AUTH_TOKEN

    Creates/returns a session cookie for a fixed test user.
    """
    if not _is_test_mode():
        raise HTTPException(status_code=404, detail="Not found")

    _check_test_auth(request)

    test_user = {
        "user_id": "test_user",
        "email": "test@example.com",
        "name": "Test User",
        "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.replace_one({"user_id": test_user["user_id"]}, test_user, upsert=True)

    session_token = f"test_session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=1)
    await db.user_sessions.insert_one(
        {
            "user_id": test_user["user_id"],
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    cookie_settings = _cookie_settings_for_request(request)
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=bool(cookie_settings["secure"]),
        samesite=str(cookie_settings["samesite"]),
        path="/",
        max_age=24 * 60 * 60,
    )

    await _log_audit(test_user["user_id"], "auth.test_login")
    return {"user": {k: test_user[k] for k in ["user_id", "email", "name", "picture"]}, "session_token": session_token}


@api_router.get("/auth/me")
async def get_current_user(request: Request):
    session_token = request.cookies.get("session_token")

    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]

    if not session_token:
        raise HTTPException(status_code=401, detail="No session token provided")

    # Validate session token
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session token")

    # Check if session is expired
    expires_at = datetime.fromisoformat(session["expires_at"])
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    # Get user data
    user = await db.users.find_one({"user_id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return {k: user[k] for k in ["user_id", "email", "name", "picture"] if k in user}



# ==================== EPIC I (MVP): MONGO-BACKED RATE LIMIT (TTL) ====================

async def _rate_limit_persistent(tenant_id: str, action: str, limit: int, window_seconds: int = 60) -> None:
    """Mongo-backed rate limiting with TTL (works across restarts).

    Stores one document per hit; TTL deletes old hits automatically.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=window_seconds)

    await db.rate_limit_hits.create_index([("expires_at", 1)], expireAfterSeconds=0)

    # count recent
    recent = await db.rate_limit_hits.count_documents(
        {"tenant_id": tenant_id, "action": action, "created_at": {"$gte": cutoff.isoformat()}}
    )
    if recent >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    await db.rate_limit_hits.insert_one(
        {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "action": action,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(seconds=window_seconds)).isoformat(),
        }
    )

    pass




def _is_test_mode() -> bool:
    return (os.environ.get("TEST_MODE", "false").lower() == "true")


def _check_test_auth(request: Request) -> None:
    expected = os.environ.get("TEST_AUTH_TOKEN")
    provided = request.headers.get("X-Test-Auth")
    if not expected or not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid test auth")


# ==================== PROD READINESS HELPERS (AUDIT + RATE LIMIT) ====================

_rate_state: Dict[str, List[float]] = {}


def _rate_limit(key: str, limit: int, window_seconds: int = 60) -> None:
    """DEPRECATED: in-memory rate limiter (kept for reference)."""
    return


# ==================== EPIC D (MVP): INGESTION + CHUNKING + "VECTOR" STORE ====================



def _get_doc_cipher() -> Optional[Fernet]:
    key = os.environ.get("DOCSTORE_KEY")
    if not key:
        return None
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        return None


def _encrypt_bytes(data: bytes) -> bytes:
    cipher = _get_doc_cipher()
    if not cipher:
        return data
    return cipher.encrypt(data)


def _decrypt_bytes(data: bytes) -> bytes:
    cipher = _get_doc_cipher()
    if not cipher:
        return data
    return cipher.decrypt(data)


def _is_pdf_url(url: str) -> bool:
    url = (url or "").lower().strip()
    return url.startswith("https://") and (url.endswith(".pdf") or ".pdf?" in url)

UPLOAD_DIR = ROOT_DIR / "uploaded_reports"
UPLOAD_DIR.mkdir(exist_ok=True)

DISCLOSURE_DOCS_DIR = ROOT_DIR / "disclosure_docs"
DISCLOSURE_DOCS_DIR.mkdir(exist_ok=True)


def _disclosure_doc_local_path(tenant_id: str, doc_id: str) -> Path:
    return DISCLOSURE_DOCS_DIR / f"{tenant_id}_{doc_id}.pdf.enc"


def _clean_text(s: str) -> str:
    s = re.sub(r"\s+", " ", s or " ").strip()
    return s


def _tokenize(s: str) -> List[str]:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9\s\-]", " ", s)
    tokens = [t for t in s.split() if len(t) > 2]
    return tokens


def _hash_id(*parts: str) -> str:
    h = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return h[:24]

def _measure_entity_id(tenant_id: str, period: str, kind: str, key: str) -> str:
    return _hash_id(tenant_id, "measure", (period or "").strip(), kind.strip(), (key or "").strip())

# ==================== EPIC H (LAYER 3 MVP): OCR / BLOCK EXTRACTION + PROVENANCE ====================

class OcrRequest(BaseModel):
    """OCR request using Gemini Flash Vision.

    Provide a single page image as base64 (PNG/JPEG/WEBP).
    Optionally provide metadata for storage/provenance.
    """

    # The base64 data *only* (no data:... prefix)
    image_base64: str
    mime_type: str = "image/png"

    # Optional provenance hooks
    doc_id: Optional[str] = None
    page_number: Optional[int] = None
    supplier_id: Optional[str] = None
    notes: Optional[str] = None


class OcrBlock(BaseModel):
    text: str
    bbox: List[float]  # [x0, y0, x1, y1] in pixel coords
    confidence: Optional[float] = None


class OcrResponse(BaseModel):
    request_id: str
    blocks: List[OcrBlock]
    raw_text: str
    created_at: str
    stored_block_ids: Optional[List[str]] = None


def _b64_to_bytes(b64: str) -> bytes:
    try:
        return base64.b64decode(b64)
    except Exception:
        return b""


def _pdf_page_to_png_base64(pdf_bytes: bytes, page_number: int, zoom: float = 2.0) -> Tuple[str, int, int]:
    """Render a PDF page to PNG base64 using PyMuPDF.

    Returns: (png_base64, width_px, height_px)
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if page_number < 1 or page_number > doc.page_count:
        raise HTTPException(status_code=400, detail=f"Invalid page_number {page_number}")

    page = doc.load_page(page_number - 1)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    png_bytes = pix.tobytes("png")
    return base64.b64encode(png_bytes).decode("utf-8"), pix.width, pix.height


async def _gemini_flash_ocr_blocks(image_base64: str, mime_type: str, session_id: str) -> Dict[str, Any]:
    """Call Gemini Flash Vision to extract text blocks + bounding boxes.

    Returns a dict with keys: raw_text, blocks[]
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception:
        # Local/demo fallback: emit deterministic pseudo-blocks with approximate bboxes.
        # This keeps the evidence UX testable without external dependencies.
        raw_text = "OCR unavailable (emergentintegrations not installed)."
        blocks = [
            {"text": "OCR unavailable", "bbox": [60, 120, 900, 200], "confidence": 0.4},
            {"text": "Install emergentintegrations + set EMERGENT_LLM_KEY", "bbox": [60, 220, 1200, 320], "confidence": 0.4},
        ]
        return {"raw_text": raw_text, "blocks": blocks}
    import json

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    system_message = """You are an OCR extraction system.

Return ONLY valid JSON with this schema:
{
  "raw_text": "string",
  "blocks": [
    {
      "text": "string",
      "bbox": [x0, y0, x1, y1],
      "confidence": 0.0
    }
  ]
}

Rules:
- bbox MUST be pixel coordinates relative to the provided image.
- Use as many blocks as needed (paragraphs/lines/table cells).
- If you cannot infer bbox confidently, still return blocks with best-effort bbox.
- Do not include any extra keys or markdown.
"""

    # NOTE: Using gemini-3-flash-preview because it is already proven working in this repo
    # with the Emergent Universal Key, and supports image attachments via base64.
    chat = (
        LlmChat(api_key=api_key, session_id=session_id, system_message=system_message)
        .with_model("gemini", "gemini-3-flash-preview")
    )

    msg = UserMessage(
        text="Extract OCR blocks with bounding boxes.",
        file_contents=[ImageContent(image_base64=image_base64)],
    )

    resp = await chat.send_message(msg)
    txt = (resp or "").strip()
    if txt.startswith("```json"):
        txt = txt[7:]
    if txt.startswith("```"):
        txt = txt[3:]
    if txt.endswith("```"):
        txt = txt[:-3]

    return json.loads(txt.strip())


@api_router.post("/execution/ocr", response_model=OcrResponse)
async def execution_ocr(payload: OcrRequest, request: Request):
    """Execution Swarm OCR endpoint (Gemini Flash Vision).

    - Accepts base64 page image
    - Returns blocks + raw_text
    - Stores an audit event

    NOTE: This is the first thin slice of Agent H (Auditor OCR).
    """
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _rate_limit_persistent(tenant_id, action="execution_ocr", limit=12, window_seconds=60)


    # Basic boundary validation (system boundary: user input)
    if not payload.image_base64 or len(payload.image_base64) < 50:
        raise HTTPException(status_code=400, detail="image_base64 must be a valid base64-encoded PNG/JPEG/WEBP")

    request_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    data = await _gemini_flash_ocr_blocks(
        image_base64=payload.image_base64,
        mime_type=payload.mime_type,
        session_id=f"ocr_{tenant_id}_{request_id}",
    )

    blocks = data.get("blocks") or []
    raw_text = data.get("raw_text") or ""

    # Persist OCR event + blocks (MVP)
    docs_to_insert = [
        {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "request_id": request_id,
            "doc_id": payload.doc_id,
            "page_number": payload.page_number,
            "supplier_id": payload.supplier_id,
            "text": b.get("text", ""),
            "bbox": b.get("bbox", []),
            "confidence": b.get("confidence"),
            "created_at": created_at,
        }
        for b in blocks
        if (b.get("text") or "").strip()
    ]

    if docs_to_insert:
        await db.ocr_blocks.insert_many(docs_to_insert)

    # Persist OCR run summary (raw_text can be large; keep it for provenance/debug)
    try:
        await db.ocr_runs.insert_one(
            {
                "id": request_id,
                "tenant_id": tenant_id,
                "doc_id": payload.doc_id,
                "page_number": payload.page_number,
                "supplier_id": payload.supplier_id,
                "mime_type": payload.mime_type,
                "blocks_count": len(docs_to_insert),
                "raw_text": raw_text,
                "created_at": created_at,
            }
        )
    except Exception:
        # Avoid breaking core OCR flow due to logging/storage.
        pass

    await _log_audit(tenant_id, "execution.ocr", {"doc_id": payload.doc_id, "page": payload.page_number, "blocks": len(blocks)})

    return {
        "request_id": request_id,
        "blocks": blocks,
        "raw_text": raw_text,
        "created_at": created_at,
        "stored_block_ids": [d["id"] for d in docs_to_insert],
    }


class RenderAndStoreRequest(BaseModel):
    doc_id: str
    page_number: int = 1
    zoom: float = 2.0
    return_image: bool = True


def _doc_page_local_path(tenant_id: str, doc_id: str, page_number: int, zoom: float) -> Path:
    zoom_tag = str(zoom).replace(".", "_")
    return UPLOAD_DIR / f"{tenant_id}_{doc_id}_p{page_number}_z{zoom_tag}.png.enc"


async def _upsert_document_page(
    tenant_id: str,
    doc_id: str,
    page_number: int,
    zoom: float,
    png_bytes: bytes,
    width: int,
    height: int,
    mime_type: str = "image/png",
) -> Dict[str, Any]:
    await db.document_pages.create_index([("tenant_id", 1), ("doc_id", 1), ("page_number", 1), ("zoom", 1)])

    sha = hashlib.sha256(png_bytes).hexdigest()
    local_path = _doc_page_local_path(tenant_id, doc_id, page_number, zoom)
    local_path.write_bytes(_encrypt_bytes(png_bytes))

    page_id = _hash_id(tenant_id, "page", doc_id, str(page_number), str(zoom), sha[:16])
    rec = {
        "id": page_id,
        "tenant_id": tenant_id,
        "doc_id": doc_id,
        "page_number": int(page_number),
        "zoom": float(zoom),
        "mime_type": mime_type,
        "width": int(width),
        "height": int(height),
        "sha256": sha,
        "local_path": str(local_path),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.document_pages.replace_one(
        {"tenant_id": tenant_id, "id": page_id},
        rec,
        upsert=True,
    )
    return rec


@api_router.post("/execution/render-and-store-page")
async def render_and_store_page(payload: RenderAndStoreRequest, request: Request):
    """Render a PDF page, persist it as document_pages, and (optionally) return the image."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    doc_id = payload.doc_id
    page_number = int(payload.page_number or 1)
    zoom = float(payload.zoom or 2.0)

    if not doc_id:
        raise HTTPException(status_code=400, detail="doc_id required")

    rendered = await render_pdf_page({"doc_id": doc_id, "page_number": page_number, "zoom": zoom}, request)
    png_b64 = rendered.get("png_base64")
    if not png_b64:
        raise HTTPException(status_code=500, detail="Render produced no image")

    png_bytes = _b64_to_bytes(png_b64)
    page_rec = await _upsert_document_page(
        tenant_id=tenant_id,
        doc_id=doc_id,
        page_number=page_number,
        zoom=zoom,
        png_bytes=png_bytes,
        width=int(rendered.get("width") or 0),
        height=int(rendered.get("height") or 0),
        mime_type=rendered.get("mime_type") or "image/png",
    )

    await _log_audit(tenant_id, "execution.page.render_store", {"doc_id": doc_id, "page": page_number, "zoom": zoom})

    resp = {"page": page_rec}
    if payload.return_image:
        resp["image"] = rendered
    return resp


@api_router.get("/execution/document-pages")
async def list_document_pages(request: Request, doc_id: str):
    """List stored rendered pages for a document (metadata only)."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    pages = (
        await db.document_pages.find({"tenant_id": tenant_id, "doc_id": doc_id}, {"_id": 0, "local_path": 0})
        .sort([("page_number", 1), ("zoom", 1)])
        .to_list(500)
    )
    return {"pages": pages}


@api_router.get("/execution/document-pages/image")
async def get_document_page_image(request: Request, page_id: str, include_base64: bool = True):
    """Fetch a stored page image by page_id."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    page = await db.document_pages.find_one({"tenant_id": tenant_id, "id": page_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if not include_base64:
        page.pop("local_path", None)
        return {"page": page}

    local_path = page.get("local_path")
    if not local_path:
        raise HTTPException(status_code=500, detail="Stored page missing local_path")

    enc = Path(local_path).read_bytes()
    png_bytes = _decrypt_bytes(enc)
    b64 = base64.b64encode(png_bytes).decode("utf-8")

    page_meta = {k: v for k, v in page.items() if k != "local_path"}
    return {"page": page_meta, "image": {"png_base64": b64, "width": page.get("width"), "height": page.get("height"), "mime_type": page.get("mime_type")}}


@api_router.get("/execution/ocr-blocks")
async def list_ocr_blocks(request: Request, doc_id: str, page_number: int):
    """List OCR blocks for a document page (for bbox overlays)."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    q: Dict[str, Any] = {"tenant_id": tenant_id, "doc_id": doc_id, "page_number": int(page_number)}
    blocks = (
        await db.ocr_blocks.find(q, {"_id": 0})
        .sort("created_at", -1)
        .to_list(2000)
    )
    return {"blocks": blocks}


class FieldProvenanceCreate(BaseModel):
    entity_type: str
    entity_id: str
    field_key: str
    field_label: Optional[str] = None
    value: Optional[str] = None
    unit: Optional[str] = None
    doc_id: str
    page_number: int
    bbox: Optional[List[float]] = None
    ocr_block_ids: Optional[List[str]] = None
    ocr_request_id: Optional[str] = None
    notes: Optional[str] = None


def _normalize_unit(unit: Optional[str]) -> Optional[str]:
    if unit is None:
        return None
    u = str(unit).strip()
    if not u:
        return None

    key = re.sub(r"\s+", " ", u).strip().lower()
    key = key.replace("_", " ").strip()

    mapping = {
        "kg": "kg",
        "kilogram": "kg",
        "kilograms": "kg",
        "g": "g",
        "gram": "g",
        "grams": "g",
        "lb": "lb",
        "lbs": "lb",
        "pound": "lb",
        "pounds": "lb",
        "t": "t",
        "ton": "t",
        "tons": "t",
        "tonne": "t",
        "tonnes": "t",
        "tco2e": "tCO2e",
        "tonne co2e": "tCO2e",
        "tonnes co2e": "tCO2e",
        "mtco2e": "tCO2e",
        "kgco2e": "kgCO2e",
        "kg co2e": "kgCO2e",
        "kwh": "kWh",
        "kw h": "kWh",
        "mwh": "MWh",
        "tonne km": "tonne-km",
        "tonne-km": "tonne-km",
        "usd": "USD",
        "$": "USD",
        "us$": "USD",
        "percent": "%",
        "%": "%",
    }

    if key in mapping:
        return mapping[key]

    # Safe fallback: preserve original, but collapse whitespace.
    return re.sub(r"\s+", " ", u).strip()


def _parse_numeric_value(raw: Optional[str]) -> Tuple[Optional[float], str]:
    if raw is None:
        return None, "empty"

    s = str(raw).strip()
    if not s:
        return None, "empty"

    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1].strip()

    # common decorations
    s2 = s.replace(",", "")
    s2 = s2.replace("$", "").replace("US$", "").strip()
    if s2.endswith("%"):
        s2 = s2[:-1].strip()

    m = re.search(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?", s2)
    if not m:
        return None, "string"

    try:
        v = float(m.group(0))
    except Exception:
        return None, "string"

    if negative:
        v = -abs(v)

    if math.isfinite(v):
        return v, "number"
    return None, "string"


def _validate_bbox(bbox: Optional[List[float]], page_width: Optional[int] = None, page_height: Optional[int] = None) -> Optional[List[float]]:
    if bbox is None:
        return None
    if not isinstance(bbox, list) or len(bbox) != 4:
        raise HTTPException(status_code=400, detail="bbox must be a 4-item list: [x0,y0,x1,y1] in pixel coords")

    try:
        x0, y0, x1, y1 = [float(v) for v in bbox]
    except Exception:
        raise HTTPException(status_code=400, detail="bbox values must be numeric")

    if not all(math.isfinite(v) for v in [x0, y0, x1, y1]):
        raise HTTPException(status_code=400, detail="bbox values must be finite numbers")
    if x0 < 0 or y0 < 0 or x1 < 0 or y1 < 0:
        raise HTTPException(status_code=400, detail="bbox values must be non-negative pixel coords")
    if x1 <= x0 or y1 <= y0:
        raise HTTPException(status_code=400, detail="bbox must satisfy x1>x0 and y1>y0")

    if page_width and page_height and page_width > 0 and page_height > 0:
        if x1 > page_width + 1e-6 or y1 > page_height + 1e-6:
            raise HTTPException(status_code=400, detail="bbox must be within page bounds")

    return [x0, y0, x1, y1]


@api_router.post("/execution/field-provenance")
async def create_field_provenance(payload: FieldProvenanceCreate, request: Request):
    """Store a field-level provenance pointer to evidence (doc/page/bbox/blocks)."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await db.field_provenance.create_index([("tenant_id", 1), ("entity_type", 1), ("entity_id", 1), ("field_key", 1)])
    await db.field_provenance.create_index([("tenant_id", 1), ("doc_id", 1), ("page_number", 1)])

    if not (payload.entity_type or "").strip():
        raise HTTPException(status_code=400, detail="entity_type required")
    if not (payload.entity_id or "").strip():
        raise HTTPException(status_code=400, detail="entity_id required")
    if not (payload.field_key or "").strip():
        raise HTTPException(status_code=400, detail="field_key required")
    if not (payload.doc_id or "").strip():
        raise HTTPException(status_code=400, detail="doc_id required")
    if int(payload.page_number) < 1:
        raise HTTPException(status_code=400, detail="page_number must be >= 1")

    doc = await db.disclosure_docs.find_one({"tenant_id": tenant_id, "doc_id": payload.doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Validate bbox against a known stored render if available (best effort).
    page_width = None
    page_height = None
    try:
        pg = await db.document_pages.find_one(
            {"tenant_id": tenant_id, "doc_id": payload.doc_id, "page_number": int(payload.page_number)},
            {"_id": 0, "width": 1, "height": 1},
            sort=[("zoom", -1)],
        )
        if pg:
            page_width = int(pg.get("width") or 0) or None
            page_height = int(pg.get("height") or 0) or None
    except Exception:
        pass

    bbox = _validate_bbox(payload.bbox, page_width=page_width, page_height=page_height)

    ocr_block_ids = [str(x).strip() for x in (payload.ocr_block_ids or []) if str(x).strip()]
    if payload.ocr_block_ids is not None:
        # Caller explicitly supplied ocr_block_ids; enforce existence if any were provided.
        if ocr_block_ids:
            uniq = sorted(set(ocr_block_ids))
            blocks = await db.ocr_blocks.find({"tenant_id": tenant_id, "id": {"$in": uniq}}, {"_id": 0, "id": 1, "doc_id": 1, "page_number": 1}).to_list(len(uniq))
            found_ids = {b.get("id") for b in blocks}
            missing = [bid for bid in uniq if bid not in found_ids]
            if missing:
                raise HTTPException(status_code=400, detail=f"ocr_block_ids not found: {missing[:10]}")

            for b in blocks:
                if b.get("doc_id") != payload.doc_id or int(b.get("page_number") or 0) != int(payload.page_number):
                    raise HTTPException(status_code=400, detail="ocr_block_ids must match doc_id and page_number")

    parsed_numeric, value_type = _parse_numeric_value(payload.value)
    unit_norm = _normalize_unit(payload.unit)

    created_at = datetime.now(timezone.utc).isoformat()
    rec = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "entity_type": payload.entity_type,
        "entity_id": payload.entity_id,
        "field_key": payload.field_key,
        "field_label": payload.field_label,
        "value": payload.value,
        "unit": payload.unit,
        "unit_norm": unit_norm,
        "parsed_numeric": parsed_numeric,
        "value_type": value_type,
        "doc_id": payload.doc_id,
        "page_number": int(payload.page_number),
        "bbox": bbox,
        "ocr_block_ids": ocr_block_ids,
        "ocr_request_id": payload.ocr_request_id,
        "notes": payload.notes,
        "created_at": created_at,
        "updated_at": created_at,
    }

    await db.field_provenance.insert_one(rec)
    await _log_audit(tenant_id, "execution.field_provenance.create", {"entity_type": payload.entity_type, "entity_id": payload.entity_id, "field_key": payload.field_key})
    return {"provenance": rec}


@api_router.get("/execution/field-provenance")
async def list_field_provenance(request: Request, entity_type: str, entity_id: str):
    """List provenance records for an entity."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    recs = (
        await db.field_provenance.find({"tenant_id": tenant_id, "entity_type": entity_type, "entity_id": entity_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    return {"provenance": recs}


@api_router.delete("/execution/field-provenance/{provenance_id}")
async def delete_field_provenance(provenance_id: str, request: Request):
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await db.field_provenance.delete_one({"tenant_id": tenant_id, "id": provenance_id})
    await _log_audit(tenant_id, "execution.field_provenance.delete", {"id": provenance_id})
    return {"message": "Deleted"}


@api_router.post("/execution/render-pdf-page")
async def render_pdf_page(payload: Dict[str, Any], request: Request):
    """Render a PDF to a PNG base64.

    Supported sources:
    - disclosure_docs.local_path (downloaded https PDFs)
    - disclosure_docs.url starting with seed:// (renders a simple text page image)

    Body:
    {
      "doc_id": "...",
      "page_number": 1,
      "zoom": 2.0
    }

    Returns:
    { "png_base64": "...", "width": 123, "height": 456, "mime_type": "image/png" }
    """
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    doc_id = (payload or {}).get("doc_id")
    page_number = int((payload or {}).get("page_number") or 1)
    zoom = float((payload or {}).get("zoom") or 2.0)

    if not doc_id:
        raise HTTPException(status_code=400, detail="doc_id required")

    doc = await db.disclosure_docs.find_one({"tenant_id": tenant_id, "doc_id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 1) Real PDF bytes path
    if doc.get("local_path"):
        pdf_enc = Path(doc["local_path"]).read_bytes()
        pdf_bytes = _decrypt_bytes(pdf_enc)
        png_b64, w, h = _pdf_page_to_png_base64(pdf_bytes, page_number=page_number, zoom=zoom)
        return {"png_base64": png_b64, "width": w, "height": h, "mime_type": "image/png"}

    # 2) Seeded docs: render simple text image so the OCR pipeline can be exercised end-to-end
    url = doc.get("url", "")
    if url.startswith("seed://"):
        from PIL import Image, ImageDraw, ImageFont

        raw = await _seed_doc_text(url)
        # naive: pick the requested page from [Page N] blocks if present
        text = raw
        parts = re.split(r"\[Page\s+(\d+)\]", raw)
        if len(parts) >= 3:
            i = 1
            chosen = None
            while i < len(parts) - 1:
                pnum = int(parts[i])
                ptxt = parts[i + 1].strip()
                if pnum == page_number:
                    chosen = ptxt
                    break
                i += 2
            if chosen is not None:
                text = chosen

        # create a readable page-like image
        width, height = 1400, 1800
        img = Image.new("RGB", (width, height), (255, 255, 255))
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("DejaVuSans.ttf", 28)
        except Exception:
            font = ImageFont.load_default()

        margin = 80
        y = margin
        for line in re.split(r"(?<=\.)\s+", text.strip()):
            if not line:
                continue
            # wrap
            words = line.split()
            cur = ""
            for w_ in words:
                test = (cur + " " + w_).strip()
                if draw.textlength(test, font=font) > (width - 2 * margin):
                    draw.text((margin, y), cur, fill=(0, 0, 0), font=font)
                    y += 40
                    cur = w_
                else:
                    cur = test
            if cur:
                draw.text((margin, y), cur, fill=(0, 0, 0), font=font)
                y += 50
            if y > height - margin:
                break

        import io

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        png_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return {"png_base64": png_b64, "width": width, "height": height, "mime_type": "image/png"}

    raise HTTPException(status_code=400, detail="Document is not renderable (missing PDF bytes)")



def _embed_mock(text: str, dim: int = 128) -> List[float]:
    """Deterministic lightweight embedding-like vector.

    This avoids calling external embedding services and is sufficient for MVP retrieval.
    """
    vec = [0.0] * dim
    for tok in _tokenize(text):
        idx = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16) % dim
        vec[idx] += 1.0
    # L2 normalize
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


# ==================== REPORTING PERIOD LOCKS (MVP) ====================

class ReportingPeriodCreate(BaseModel):
    period: str
    label: Optional[str] = None


async def _enforce_reporting_period_unlocked(tenant_id: str, period: str, action: str) -> None:
    p = (period or "").strip()
    if not p:
        raise HTTPException(status_code=400, detail="period required")

    await db.reporting_period_locks.create_index([("tenant_id", 1), ("period", 1)], unique=True)

    lock = await db.reporting_period_locks.find_one({"tenant_id": tenant_id, "period": p}, {"_id": 0})
    if lock and lock.get("status") == "locked":
        raise HTTPException(status_code=423, detail=f"Reporting period '{p}' is locked; cannot {action}")


@api_router.post("/execution/reporting-period-locks")
async def create_reporting_period_lock(payload: ReportingPeriodCreate, request: Request):
    """Create (or upsert) a reporting period lock record. Defaults to unlocked."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    period = (payload.period or "").strip()
    if not period:
        raise HTTPException(status_code=400, detail="period required")

    await db.reporting_period_locks.create_index([("tenant_id", 1), ("period", 1)], unique=True)

    now = datetime.now(timezone.utc).isoformat()
    lock_id = _hash_id(tenant_id, "reporting_period", period)
    rec = {
        "id": lock_id,
        "tenant_id": tenant_id,
        "period": period,
        "label": payload.label,
        "status": "open",
        "locked_at": None,
        "locked_by": None,
        "created_at": now,
        "updated_at": now,
    }

    existing = await db.reporting_period_locks.find_one({"tenant_id": tenant_id, "period": period}, {"_id": 0})
    if existing:
        update: Dict[str, Any] = {"updated_at": now}
        if payload.label is not None:
            update["label"] = payload.label
        await db.reporting_period_locks.update_one({"tenant_id": tenant_id, "period": period}, {"$set": update})
        existing.update(update)
        return {"lock": existing}

    await db.reporting_period_locks.insert_one(rec)
    await _log_audit(tenant_id, "execution.reporting_period_lock.create", {"period": period})
    return {"lock": rec}


@api_router.get("/execution/reporting-period-locks")
async def list_reporting_period_locks(request: Request):
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    locks = (
        await db.reporting_period_locks.find({"tenant_id": tenant_id}, {"_id": 0})
        .sort([("period", 1)])
        .to_list(500)
    )
    return {"locks": locks}


@api_router.post("/execution/reporting-period-locks/{period}/lock")
async def lock_reporting_period(period: str, request: Request):
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    p = (period or "").strip()
    if not p:
        raise HTTPException(status_code=400, detail="period required")

    await db.reporting_period_locks.create_index([("tenant_id", 1), ("period", 1)], unique=True)

    now = datetime.now(timezone.utc).isoformat()
    lock_id = _hash_id(tenant_id, "reporting_period", p)
    await db.reporting_period_locks.update_one(
        {"tenant_id": tenant_id, "period": p},
        {
            "$setOnInsert": {"id": lock_id, "tenant_id": tenant_id, "period": p, "created_at": now},
            "$set": {"status": "locked", "locked_at": now, "locked_by": tenant_id, "updated_at": now},
        },
        upsert=True,
    )
    lock = await db.reporting_period_locks.find_one({"tenant_id": tenant_id, "period": p}, {"_id": 0})
    await _log_audit(tenant_id, "execution.reporting_period_lock.lock", {"period": p})
    return {"lock": lock}



@api_router.get("/pipeline/docs")
async def list_disclosure_docs(request: Request):
    """List disclosure_docs for the current tenant (for Evidence/OCR workflows)."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    docs = await db.disclosure_docs.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(200)
    # Keep payload small
    for d in docs:
        d.pop("content", None)
    return {"docs": docs}


@api_router.post("/pipeline/docs/upload")
async def upload_disclosure_pdf(
    request: Request,
    file: UploadFile = File(...),
    company_id: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    period: str = "last_12_months",
):
    """Upload a PDF into disclosure_docs and store encrypted bytes on disk.

    doc_id is stable: sha256(pdf_bytes).
    """
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action="upload documents")

    if not _get_doc_cipher():
        raise HTTPException(status_code=500, detail="DOCSTORE_KEY not configured (required for encrypted upload)")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty upload")

    if pdf_bytes[:4] != b"%PDF":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    # Basic validation to fail fast on corrupt uploads
    try:
        PdfReader(BytesIO(pdf_bytes))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PDF")

    sha = hashlib.sha256(pdf_bytes).hexdigest()
    doc_id = sha
    size_bytes = int(len(pdf_bytes))

    await db.disclosure_docs.create_index([("tenant_id", 1), ("doc_id", 1)])

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.disclosure_docs.find_one({"tenant_id": tenant_id, "doc_id": doc_id}, {"_id": 0})
    uploaded_at = (existing or {}).get("uploaded_at") or now
    created_at = (existing or {}).get("created_at") or now

    local_path = _disclosure_doc_local_path(tenant_id, doc_id)
    local_path.write_bytes(_encrypt_bytes(pdf_bytes))

    doc = {
        "doc_id": doc_id,
        "tenant_id": tenant_id,
        "company_id": company_id,
        "category": category,
        "title": title or file.filename or "Uploaded PDF",
        "filename": file.filename,
        "size_bytes": size_bytes,
        "content_type": "pdf",
        "sha256": sha,
        "local_path": str(local_path),
        "source": "upload",
        "uploaded_at": uploaded_at,
        "created_at": created_at,
        "updated_at": now,
    }

    await db.disclosure_docs.replace_one(
        {"tenant_id": tenant_id, "doc_id": doc_id},
        doc,
        upsert=True,
    )

    await _log_audit(tenant_id, "pipeline.docs.upload", {"doc_id": doc_id, "size_bytes": size_bytes})
    return {"doc": {k: v for k, v in doc.items() if k != "local_path"}}


@api_router.delete("/pipeline/docs/{doc_id}")
async def delete_uploaded_disclosure_doc(doc_id: str, request: Request, period: str = "last_12_months"):
    """Delete an uploaded disclosure doc (source='upload') and its stored bytes."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action="delete documents")

    doc = await db.disclosure_docs.find_one({"tenant_id": tenant_id, "doc_id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.get("source") != "upload":
        raise HTTPException(status_code=400, detail="Only uploaded documents can be deleted via this endpoint")

    # Remove stored encrypted PDF bytes
    local_path = doc.get("local_path")
    if local_path:
        try:
            p = Path(local_path)
            if p.exists():
                p.unlink()
        except Exception:
            pass

    # Best-effort cleanup of derived artifacts
    try:
        pages = await db.document_pages.find({"tenant_id": tenant_id, "doc_id": doc_id}, {"_id": 0, "local_path": 1}).to_list(5000)
        for pg in pages:
            lp = pg.get("local_path")
            if not lp:
                continue
            try:
                pp = Path(lp)
                if pp.exists():
                    pp.unlink()
            except Exception:
                pass
        await db.document_pages.delete_many({"tenant_id": tenant_id, "doc_id": doc_id})
    except Exception:
        pass

    try:
        await db.ocr_blocks.delete_many({"tenant_id": tenant_id, "doc_id": doc_id})
        await db.ocr_runs.delete_many({"tenant_id": tenant_id, "doc_id": doc_id})
        await db.field_provenance.delete_many({"tenant_id": tenant_id, "doc_id": doc_id})
    except Exception:
        pass

    await db.disclosure_docs.delete_one({"tenant_id": tenant_id, "doc_id": doc_id})
    await _log_audit(tenant_id, "pipeline.docs.delete", {"doc_id": doc_id})
    return {"message": "Deleted", "doc_id": doc_id}


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    return float(sum(x * y for x, y in zip(a, b)))


def _chunk_text(text: str, chunk_size: int = 1200, overlap: int = 120) -> List[str]:
    text = _clean_text(text)
    if not text:
        return []
    chunks: List[str] = []
    i = 0
    while i < len(text):
        end = min(len(text), i + chunk_size)
        chunks.append(text[i:end])
        if end == len(text):
            break
        i = max(0, end - overlap)
    return chunks


class DisclosureSourceRegister(BaseModel):
    company_id: str
    category: str
    title: str
    url: str


@api_router.post("/pipeline/sources/register")
async def register_disclosure_sources(payload: List[DisclosureSourceRegister], request: Request, period: str = "last_12_months"):
    """Register disclosure sources (PDF URLs only for this phase)."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action="register disclosure sources")

    for s in payload:
        if not _is_pdf_url(s.url):
            raise HTTPException(status_code=400, detail=f"Only https PDF URLs allowed: {s.url}")

    await db.disclosure_sources.create_index([("tenant_id", 1), ("company_id", 1), ("category", 1)])

    docs = []
    for s in payload:
        docs.append(
            {
                "id": _hash_id(tenant_id, "src", s.company_id, s.category, s.url),
                "tenant_id": tenant_id,
                "company_id": s.company_id,
                "category": s.category,
                "title": s.title,
                "url": s.url,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    # Upsert each to avoid duplicates
    for d in docs:
        await db.disclosure_sources.replace_one({"id": d["id"]}, d, upsert=True)

    await _log_audit(tenant_id, "pipeline.sources.register", {"count": len(docs)})
    return {"message": "Sources registered", "count": len(docs)}


async def _vector_search(tenant_id: str, company_id: str, category: str, query: str, k: int = 6) -> List[Dict[str, Any]]:
    qvec = _embed_mock(query)
    docs = await db.disclosure_chunks.find(
        {"tenant_id": tenant_id, "company_id": company_id, "category": category},
        {"_id": 0},
    ).to_list(200)

    scored = []
    for d in docs:
        score = _cosine(qvec, d.get("embedding", []))
        scored.append((score, d))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {**d, "score": round(float(score), 4)}
        for score, d in scored[:k]
        if score > 0
    ]


@api_router.post("/pipeline/sources/seed")
async def seed_disclosure_sources(request: Request, period: str = "last_12_months"):
    """Seed realistic disclosure sources + reports for peers (MVP).

    Creates:
    - disclosure_sources: (peer_id, category, doc_url/title)
    - disclosure_docs: metadata (doc_id)

    Then chunks are created via /api/pipeline/ingest.
    """
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action="seed disclosure sources")

    await db.disclosure_sources.delete_many({"tenant_id": tenant_id})
    await db.disclosure_docs.delete_many({"tenant_id": tenant_id})

    # Realistic public-report URLs would be used in production; for MVP we use seeded docs.
    sources = [
        {
            "id": _hash_id(tenant_id, "sika", "pgs"),
            "tenant_id": tenant_id,
            "company_id": "sika_001",
            "category": "Purchased Goods & Services",
            "title": "Sika Sustainability Report 2023 (Seeded)",
            "url": "seed://sika/2023",
        },
        {
            "id": _hash_id(tenant_id, "dhl", "tnd"),
            "tenant_id": tenant_id,
            "company_id": "dhl_001",
            "category": "Transport & Distribution",
            "title": "DHL ESG Report 2023 (Seeded)",
            "url": "seed://dhl/2023",
        },
        {
            "id": _hash_id(tenant_id, "basf", "fea"),
            "tenant_id": tenant_id,
            "company_id": "basf_001",
            "category": "Fuel & Energy Activities",
            "title": "BASF Annual Report 2023 (Seeded)",
            "url": "seed://basf/2023",
        },
    ]

    docs = [
        {
            "doc_id": _hash_id(tenant_id, "doc", "sika", "2023"),
            "tenant_id": tenant_id,
            "company_id": "sika_001",
            "title": "Sika Sustainability Report 2023",
            "url": "seed://sika/2023",
            "content_type": "text",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "doc_id": _hash_id(tenant_id, "doc", "dhl", "2023"),
            "tenant_id": tenant_id,
            "company_id": "dhl_001",
            "title": "DHL ESG Report 2023",
            "url": "seed://dhl/2023",
            "content_type": "text",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "doc_id": _hash_id(tenant_id, "doc", "basf", "2023"),
            "tenant_id": tenant_id,
            "company_id": "basf_001",
            "title": "BASF Annual Report 2023",
            "url": "seed://basf/2023",
            "content_type": "text",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    await db.disclosure_sources.insert_many(sources)
    await db.disclosure_docs.insert_many(docs)

    return {"message": "Disclosure sources seeded", "sources": len(sources), "docs": len(docs)}


async def _seed_doc_text(url: str) -> str:
    # Seeded corpus (realistic excerpts; in production this would be parsed from PDFs)
    if url.startswith("seed://sika"):
        return """
        [Page 45] In 2022/2023, Sika reduced product carbon intensity by expanding bio-based polymer inputs and increasing post-consumer recycled (PCR) content in packaging to 80%.
        [Page 46] Sika implemented supplier specifications requiring minimum recycled content thresholds and audited tier-2 chemical inputs for lifecycle emissions hotspots.
        [Page 47] Procurement introduced contractual recycled-content requirements and supplier scorecards, improving traceability for key raw materials.
        """
    if url.startswith("seed://dhl"):
        return """
        [Page 12] DHL deployed electric delivery vehicles in dense urban routes and used route-optimization software to reduce empty miles and fuel burn.
        [Page 13] For long-haul air freight, DHL increased Sustainable Aviation Fuel (SAF) procurement and shifted eligible lanes to intermodal rail alternatives.
        [Page 14] DHL required carriers to provide fuel and distance activity data, enabling shipment-level carbon accounting.
        """
    if url.startswith("seed://basf"):
        return """
        [Page 88] BASF expanded renewable electricity procurement via Power Purchase Agreements (PPAs) and electrified steam generation to reduce upstream energy intensity.
        [Page 89] BASF implemented heat integration and process optimization in energy-intensive units, prioritizing sites with highest marginal abatement potential.
        [Page 90] BASF updated supplier engagement programs to request energy procurement disclosure and site-level electricity mix.
        """
    return ""


async def _download_pdf(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.content


def _pdf_pages_to_text(pdf_bytes: bytes) -> List[Tuple[int, str]]:
    """Extract text per page from PDF bytes."""
    reader = PdfReader(BytesIO(pdf_bytes))
    pages: List[Tuple[int, str]] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        pages.append((i, _clean_text(text)))
    return pages


@api_router.post("/pipeline/download")
async def download_disclosures(request: Request, period: str = "last_12_months"):
    """Download all registered PDF sources for the tenant into uploaded_reports/.

    Stores encrypted bytes on disk if DOCSTORE_KEY is configured.
    """
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action="download disclosures")

    await _rate_limit_persistent(tenant_id, action="pipeline_download", limit=3, window_seconds=60)

    sources = await db.disclosure_sources.find(
        {"tenant_id": tenant_id, "url": {"$regex": r"^https://"}},
        {"_id": 0},
    ).to_list(200)

    if not sources:
        return {"message": "No https PDF sources registered", "downloaded": 0}

    await db.disclosure_docs.create_index([("tenant_id", 1), ("doc_id", 1)])

    downloaded = 0
    failures = []

    for s in sources:
        try:
            pdf = await _download_pdf(s["url"])
            sha = hashlib.sha256(pdf).hexdigest()
            doc_id = _hash_id(tenant_id, "doc", sha)

            local_path = UPLOAD_DIR / f"{tenant_id}_{doc_id}.pdf.enc"
            local_path.write_bytes(_encrypt_bytes(pdf))

            doc = {
                "doc_id": doc_id,
                "tenant_id": tenant_id,
                "company_id": s["company_id"],
                "title": s["title"],
                "url": s["url"],
                "content_type": "pdf",
                "sha256": sha,
                "local_path": str(local_path),
                "downloaded_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            await db.disclosure_docs.replace_one(
                {"tenant_id": tenant_id, "doc_id": doc_id},
                doc,
                upsert=True,
            )

            downloaded += 1
        except Exception as e:
            failures.append({"url": s.get("url"), "error": str(e)})

    await _log_audit(tenant_id, "pipeline.download", {"downloaded": downloaded, "failures": len(failures)})
    return {"message": "Download complete", "downloaded": downloaded, "failures": failures}


@api_router.post("/pipeline/ingest")
async def ingest_disclosures(request: Request, period: str = "last_12_months"):
    """Ingestion: reads disclosure_sources and produces chunk + embedding records.

    Supports:
    - seeded sources (seed://...) via _seed_doc_text
    - registered https PDF sources (downloaded into disclosure_docs)
    """
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action="ingest disclosures")

    await _rate_limit_persistent(tenant_id, action="pipeline_ingest", limit=6, window_seconds=60)

    sources = await db.disclosure_sources.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(200)
    if not sources:
        return {"message": "No sources found. Seed or register sources first.", "chunks_created": 0}

    # Clear previous tenant chunks
    await db.disclosure_chunks.delete_many({"tenant_id": tenant_id})

    # Ensure vector search is fast enough for MVP.
    await db.disclosure_chunks.create_index([("tenant_id", 1), ("company_id", 1), ("category", 1)])

    created = 0

    for s in sources:
        url = s["url"]
        page_pairs: List[Tuple[int, str]] = []

        if url.startswith("seed://"):
            raw = await _seed_doc_text(url)
            parts = re.split(r"\[Page\s+(\d+)\]", raw)
            if len(parts) >= 3:
                i = 1
                while i < len(parts) - 1:
                    page = parts[i]
                    text = parts[i + 1]
                    page_pairs.append((int(page), _clean_text(text)))
                    i += 2
            else:
                page_pairs = [(1, _clean_text(raw))]
        else:
            # PDF path: find the downloaded doc for this source
            doc = await db.disclosure_docs.find_one(
                {"tenant_id": tenant_id, "url": url},
                {"_id": 0}
            )
            if not doc:
                # not downloaded yet
                continue

            try:
                pdf_enc = Path(doc["local_path"]).read_bytes()
                pdf_bytes = _decrypt_bytes(pdf_enc)
                page_pairs = _pdf_pages_to_text(pdf_bytes)
            except Exception:
                page_pairs = []

        for page, page_text in page_pairs:
            if not page_text:
                continue
            for chunk in _chunk_text(page_text, chunk_size=900, overlap=80):
                doc_chunk = {
                    "id": _hash_id(tenant_id, s["company_id"], s["category"], url, str(page), chunk[:64]),
                    "tenant_id": tenant_id,
                    "company_id": s["company_id"],
                    "category": s["category"],
                    "title": s["title"],
                    "url": url,
                    "page": page,
                    "excerpt": chunk,
                    "embedding": _embed_mock(chunk),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.disclosure_chunks.insert_one(doc_chunk)
                created += 1

    await _log_audit(tenant_id, "pipeline.ingest", {"chunks_created": created})
    return {"message": "Ingestion complete", "chunks_created": created}


@api_router.post("/pipeline/generate")
async def generate_recommendations_batch(request: Request, period: str = "last_12_months"):
    """MVP generation: for each benchmark, retrieve chunks and generate cached recommendations."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action="generate recommendations")

    await _rate_limit_persistent(tenant_id, action="pipeline_generate", limit=4, window_seconds=60)

    benchmarks = await db.supplier_benchmarks.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(500)
    if not benchmarks:
        return {"message": "No benchmarks found. Run /api/pipeline/run first.", "generated": 0}

    generated = 0
    for b in benchmarks:
        # Skip leaders
        if float(b.get("supplier_intensity", 0)) <= float(b.get("peer_intensity", 0)):
            continue

        query = f"{b.get('peer_name','')} {b.get('category','')} emissions reduction actions"
        retrieved = await _vector_search(tenant_id, b["peer_id"], b["category"], query, k=6)

        if not retrieved:
            rec = build_generic_recommendation_template(b, "missing_public_report")
            rec["tenant_id"] = tenant_id
            await db.recommendation_content.replace_one(
                {"benchmark_id": b["id"], "tenant_id": tenant_id},
                {**rec, "benchmark_id": b["id"], "tenant_id": tenant_id},
                upsert=True,
            )
            continue

        raw_context = "\n\n".join([f"[Pg {r.get('page')}] {r.get('excerpt')}" for r in retrieved])
        citations = [
            {"title": r.get("title"), "url": r.get("url"), "page": str(r.get("page")), "quote": r.get("excerpt")}
            for r in retrieved
        ]

        rec = await generate_ai_recommendation(b, raw_context, citations)
        rec["tenant_id"] = tenant_id
        await db.recommendation_content.replace_one(
            {"benchmark_id": b["id"], "tenant_id": tenant_id},
            {**rec, "benchmark_id": b["id"], "tenant_id": tenant_id},
            upsert=True,
        )
        generated += 1

    await _log_audit(tenant_id, "pipeline.generate", {"generated": generated})
    return {"message": "Batch generation complete", "generated": generated}

    # in-memory rate limiter removed; using Mongo-backed rate limiting with TTL instead.
    return


async def _log_audit(user_id: str, action: str, meta: Optional[Dict[str, Any]] = None) -> None:
    try:
        await db.audit_events.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "action": action,
                "meta": meta or {},
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception:
        # Avoid breaking user flows for audit logging.
        return


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    user_id = None
    if session_token:
        session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session_doc:
            user_id = session_doc.get("user_id")
        await db.user_sessions.delete_one({"session_token": session_token})

    if user_id:
        await _log_audit(user_id, "auth.logout")

    response.delete_cookie(key="session_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out successfully"}


async def get_user_from_request(request: Request) -> dict:
    session_token = request.cookies.get("session_token")

    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    return user_doc


# ==================== MOCK PIPELINE: INGESTION -> “EVIDENCE CHUNKS” ====================

async def build_evidence_context(peer_id: str, category: str, tenant_id: str) -> Tuple[str, List[Dict[str, Any]]]:
    chunks = await db.disclosure_chunks.find(
        {"tenant_id": tenant_id, "company_id": peer_id, "category": category},
        {"_id": 0},
    ).sort("page", 1).to_list(20)

    if not chunks:
        return "", []

    context_lines: List[str] = []
    citations: List[Dict[str, Any]] = []

    for c in chunks:
        page = c.get("page")
        excerpt = (c.get("excerpt") or "").strip()
        title = c.get("title") or "Sustainability Report"
        url = c.get("url") or ""

        context_lines.append(f"[Pg {page}] {excerpt}")
        citations.append(
            {
                "title": title,
                "url": url,
                "page": str(page) if page is not None else "",
                "quote": excerpt,
            }
        )

    return "\n\n".join(context_lines), citations


def build_generic_recommendation_template(benchmark: dict, reason: str) -> dict:
    peer = benchmark.get("peer_name", "Peer")
    category = benchmark.get("category", "Scope 3")

    if reason == "missing_public_report":
        headline = f"No public sustainability report could be retrieved for {peer} in {category}."
        case_study = (
            f"We could not retrieve a public report for {peer} to provide peer-validated steps. "
            "To proceed, request primary data from your supplier and ask for a category-specific reduction roadmap."
        )
    else:
        headline = f"Insufficient evidence in the retrieved context to produce a peer-validated action plan for {category}."
        case_study = (
            f"We retrieved limited disclosures for {peer}, but did not find explicit, technical actions tied to {category}. "
            "Ask your supplier for a detailed abatement plan and supporting documentation."
        )

    contract_clause = (
        "Supplier shall, within ninety (90) days of the Effective Date, deliver to Customer a category-specific "
        "Scope 3 emissions reduction plan (including baselines, measures, milestones, and reporting cadence) and "
        "thereafter report progress quarterly. Failure to provide such plan or reports shall constitute a material breach."
    )

    return {
        "benchmark_id": benchmark["id"],
        "headline": headline,
        "action_plan": None,
        "case_study_summary": case_study,
        "contract_clause": contract_clause,
        "feasibility_timeline": "4-12 weeks to produce plan; 12-36 months to implement",
        "source_citations": [],
        "evidence_status": reason,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def generate_ai_recommendation(
    benchmark: dict,
    raw_text_context: str,
    source_citations: List[Dict[str, Any]],
) -> dict:
    """LLM Generation step (MOCK RAG): strictly extract actions from provided context."""
    try:
        import json
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        # Deterministic fallback: do not error-spam when optional LLM deps are absent.
        logger.info("LLM generation skipped (optional emergentintegrations not installed).")
        return build_generic_recommendation_template(benchmark, "insufficient_context")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logger.info("LLM generation skipped (EMERGENT_LLM_KEY not set).")
        return build_generic_recommendation_template(benchmark, "insufficient_context")

        system_prompt = """You are an expert Supply Chain Sustainability Analyst and Legal Contract Strategist.

### INPUT DATA
You will be given Peer Name, Supplier Name, Category, and Context (excerpts from the Peer report).

### STRICT GUIDELINES (GUARDRAILS)
1. Zero Hallucination: You must cite the specific page number/section from the Context for every claim. If the Context does not mention specific actions, return null for the action_plan.
2. Technical Specificity: Do not use vague fluff. Look for hard engineering keywords: "Bio-based," "Electric Arc Furnace," "Recycled Content," "Renewable Energy PPAs," "Intermodal Transport."
3. Legal Tone: The Contract Clause must be written in formal legal language suitable for an MSA renewal and must make reductions mandatory.

### OUTPUT JSON SCHEMA
Return ONLY valid JSON:
{
  "headline": "String",
  "action_plan": [
    {"step": 1, "title": "String", "detail": "String", "citation": "String"}
  ] | null,
  "case_study_summary": "String",
  "contract_clause": "String",
  "feasibility_timeline": "String"
}
"""

    try:
        chat = (
            LlmChat(
                api_key=api_key,
                session_id=f"action_extractor_{benchmark['id']}",
                system_message=system_prompt,
            ).with_model("gemini", "gemini-3-flash-preview")
        )

        prompt = f"""Peer Name: {benchmark['peer_name']}
Supplier Name: {benchmark['supplier_name']}
Category: {benchmark['category']}

Context:
{raw_text_context}
"""

        response = await chat.send_message(UserMessage(text=prompt))
        response_text = (response or "").strip()

        # Extract JSON from fenced blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        ai_content = json.loads(response_text.strip())
        action_plan = ai_content.get("action_plan")

        evidence_status = "ok" if action_plan else "insufficient_context"

        return {
            "benchmark_id": benchmark["id"],
            "headline": ai_content.get("headline", ""),
            "action_plan": action_plan,
            "case_study_summary": ai_content.get("case_study_summary", ""),
            "contract_clause": ai_content.get("contract_clause", ""),
            "feasibility_timeline": ai_content.get("feasibility_timeline", "24-36 months"),
            "source_citations": source_citations,
            "evidence_status": evidence_status,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.warning(f"LLM generation failed; falling back to generic template: {e}")
        return build_generic_recommendation_template(benchmark, "insufficient_context")


async def get_or_generate_recommendation(benchmark: dict) -> dict:
    cached = await db.recommendation_content.find_one(
        {"benchmark_id": benchmark["id"], "tenant_id": benchmark.get("tenant_id")},
        {"_id": 0}
    )
    if cached:
        return cached

    raw_context, citations = await build_evidence_context(
        benchmark["peer_id"],
        benchmark["category"],
        tenant_id=benchmark.get("tenant_id")
    )
    if not raw_context.strip():
        return build_generic_recommendation_template(benchmark, "missing_public_report")

    recommendation = await generate_ai_recommendation(benchmark, raw_context, citations)

    await db.recommendation_content.replace_one(
        {"benchmark_id": benchmark["id"], "tenant_id": benchmark.get("tenant_id")},
        {**recommendation, "benchmark_id": benchmark["id"], "tenant_id": benchmark.get("tenant_id")},
        upsert=True,
    )
    return recommendation


def build_deep_dive_response(benchmark: dict, recommendation: dict) -> dict:
    source_docs = []
    for c in recommendation.get("source_citations", []) or []:
        source_docs.append(
            {
                "title": c.get("title", "Source"),
                "url": c.get("url", ""),
                "page": c.get("page", ""),
            }
        )

    return {
        "meta": {
            "supplier_name": benchmark["supplier_name"],
            "peer_name": benchmark["peer_name"],
            "comparison_year": str(benchmark.get("comparison_year", "2024")),
            "industry_sector": benchmark.get("industry_sector"),
            "category": benchmark["category"],
            "isic_code": benchmark.get("isic_code"),
            "revenue_band": benchmark.get("revenue_band"),
        },
        "metrics": {
            "current_intensity": benchmark["supplier_intensity"],
            "target_intensity": benchmark["peer_intensity"],
            "reduction_potential_percentage": benchmark["potential_reduction_pct"],
            "upstream_impact_percentage": benchmark["upstream_impact_pct"],
            "cee_rating": benchmark["cee_rating"],
        },
        "content": {
            "headline": recommendation.get("headline", ""),
            "action_plan": recommendation.get("action_plan"),
            "case_study_summary": recommendation.get("case_study_summary", ""),
            "contract_clause": recommendation.get("contract_clause", ""),
            "feasibility_timeline": recommendation.get("feasibility_timeline", "24-36 months"),
            "source_docs": source_docs,
            "source_citations": recommendation.get("source_citations", []),
            "evidence_status": recommendation.get("evidence_status", "ok"),
        },
    }


async def get_benchmark_by_supplier_identifier(supplier_identifier: str, tenant_id: str) -> Optional[dict]:
    benchmark = await db.supplier_benchmarks.find_one(
        {"id": supplier_identifier, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if benchmark:
        return benchmark
    return await db.supplier_benchmarks.find_one(
        {"supplier_id": supplier_identifier, "tenant_id": tenant_id},
        {"_id": 0}
    )


# ==================== SUPPLIER ENDPOINTS ====================

@api_router.get("/suppliers")
async def get_suppliers(request: Request):
    """Top Reduction Actions table (default excludes leaders + zero impact)."""
    user = await get_user_from_request(request)

    base_query: Dict[str, Any] = {
        "tenant_id": user["user_id"],
        "upstream_impact_pct": {"$gt": 0},
        "$expr": {"$gt": ["$supplier_intensity", "$peer_intensity"]},
    }

    suppliers = (
        await db.supplier_benchmarks.find(base_query, {"_id": 0})
        .sort("upstream_impact_pct", -1)
        .to_list(500)
    )

    return {"suppliers": suppliers, "total": len(suppliers)}


@api_router.get("/suppliers/filter")
async def get_filtered_suppliers(
    request: Request,
    category: Optional[str] = None,
    rating: Optional[str] = None,
    min_impact: Optional[float] = None,
    max_impact: Optional[float] = None,
    min_reduction: Optional[float] = None,
    sort_by: str = "upstream_impact_pct",
    sort_order: str = "desc",
):
    """Server-side filtering (default excludes leaders + zero impact)."""
    await get_user_from_request(request)

    user = await get_user_from_request(request)

    query: Dict[str, Any] = {
        "tenant_id": user["user_id"],
        "upstream_impact_pct": {"$gt": 0},
        "$expr": {"$gt": ["$supplier_intensity", "$peer_intensity"]},
    }

    if category:
        query["category"] = {"$regex": category, "$options": "i"}

    if min_impact is not None:
        query.setdefault("upstream_impact_pct", {})
        query["upstream_impact_pct"]["$gte"] = min_impact

    if max_impact is not None:
        query.setdefault("upstream_impact_pct", {})
        query["upstream_impact_pct"]["$lte"] = max_impact

    if min_reduction is not None:
        query["potential_reduction_pct"] = {"$gte": min_reduction}

    # rating filter handled in Python to keep query simple/compatible
    suppliers = await db.supplier_benchmarks.find(query, {"_id": 0}).to_list(500)

    if rating:
        ratings = [r.strip().upper() for r in rating.split(",") if r.strip()]
        if ratings:
            suppliers = [s for s in suppliers if str(s.get("cee_rating", "")).upper().startswith(tuple(ratings))]

    sort_direction = -1 if sort_order == "desc" else 1
    suppliers.sort(key=lambda s: s.get(sort_by, 0), reverse=(sort_direction == -1))

    all_categories = sorted(await db.supplier_benchmarks.distinct("category"))
    all_ratings_full = sorted(await db.supplier_benchmarks.distinct("cee_rating"))
    all_ratings = sorted(list({(r or "")[0].upper() for r in all_ratings_full if r}))

    return {
        "suppliers": suppliers,
        "total": len(suppliers),
        "filters": {
            "categories": all_categories,
            "ratings": all_ratings,
            "applied": {
                "category": category,
                "rating": rating,
                "min_impact": min_impact,
                "max_impact": max_impact,
                "min_reduction": min_reduction,
            },
        },
    }


@api_router.get("/suppliers/heatmap")
async def get_heatmap_data(request: Request):
    """Heatmap supports the alternative visual path; uses same default exclusions."""
    await get_user_from_request(request)

    user = await get_user_from_request(request)

    base_query: Dict[str, Any] = {
        "tenant_id": user["user_id"],
        "upstream_impact_pct": {"$gt": 0},
        "$expr": {"$gt": ["$supplier_intensity", "$peer_intensity"]},
    }

    suppliers = await db.supplier_benchmarks.find(
        base_query,
        {
            "_id": 0,
            "id": 1,
            "supplier_name": 1,
            "category": 1,
            "supplier_intensity": 1,
            "potential_reduction_pct": 1,
            "cee_rating": 1,
        },
    ).to_list(500)

    return {"heatmap_data": suppliers}


@api_router.get("/suppliers/{supplier_id}/deep-dive")
async def get_supplier_deep_dive(supplier_id: str, request: Request):
    """Legacy deep-dive endpoint used by the current frontend."""
    user = await get_user_from_request(request)
    await _rate_limit_persistent(user["user_id"], action="deep_dive", limit=15, window_seconds=60)

    benchmark = await get_benchmark_by_supplier_identifier(supplier_id, tenant_id=user["user_id"])
    if not benchmark:
        raise HTTPException(status_code=404, detail="Supplier not found")

    recommendation = await get_or_generate_recommendation(benchmark)
    await _log_audit(user["user_id"], "deep_dive.view", {"benchmark_id": benchmark["id"]})
    return build_deep_dive_response(benchmark, recommendation)


@api_router.get("/v1/recommendations/supplier/{supplier_id}/deep-dive")
async def get_supplier_deep_dive_v1(supplier_id: str, request: Request):
    """Tech-spec endpoint: returns the engineering handover contract JSON."""
    user = await get_user_from_request(request)

    benchmark = await get_benchmark_by_supplier_identifier(supplier_id, tenant_id=user["user_id"])
    if not benchmark:
        raise HTTPException(status_code=404, detail="Supplier not found")

    recommendation = await get_or_generate_recommendation(benchmark)

    source_docs = []
    for c in recommendation.get("source_citations", []) or []:
        if c.get("url"):
            source_docs.append({"title": c.get("title", "Sustainability Report"), "url": c.get("url")})

    return {
        "meta": {
            "supplier_name": benchmark["supplier_name"],
            "peer_name": benchmark["peer_name"],
            "comparison_year": str(benchmark.get("comparison_year", "2024")),
        },
        "metrics": {
            "current_intensity": benchmark["supplier_intensity"],
            "target_intensity": benchmark["peer_intensity"],
            "reduction_potential_percentage": benchmark["potential_reduction_pct"],
        },
        "content": {
            "headline": recommendation.get("headline", ""),
            "action_plan": recommendation.get("action_plan"),
            "contract_clause": recommendation.get("contract_clause", ""),
            "source_docs": source_docs,
        },
    }


# ==================== ENGAGEMENT TRACKING ====================

@api_router.get("/engagements")
async def get_all_engagements(request: Request):
    user = await get_user_from_request(request)

    engagements = await db.supplier_engagements.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    return {"engagements": engagements}


@api_router.get("/engagements/{supplier_id}")
async def get_engagement(supplier_id: str, request: Request):
    user = await get_user_from_request(request)

    engagement = await db.supplier_engagements.find_one(
        {"user_id": user["user_id"], "supplier_id": supplier_id},
        {"_id": 0},
    )

    if not engagement:
        return {
            "supplier_id": supplier_id,
            "user_id": user["user_id"],
            "status": "not_started",
            "notes": None,
            "next_action_date": None,
            "history": [],
        }

    return engagement


@api_router.put("/engagements/{supplier_id}")
async def update_engagement(supplier_id: str, update: EngagementUpdate, request: Request):
    user = await get_user_from_request(request)
    await _rate_limit_persistent(user["user_id"], action="engagement", limit=30, window_seconds=60)

    existing = await db.supplier_engagements.find_one({"user_id": user["user_id"], "supplier_id": supplier_id})


    await _log_audit(user["user_id"], "engagement.update", {"supplier_id": supplier_id, "status": update.status})

    history_entry = {
        "status": update.status,
        "notes": update.notes,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if existing:
        history = existing.get("history", [])
        history.append(history_entry)

        await db.supplier_engagements.update_one(
            {"user_id": user["user_id"], "supplier_id": supplier_id},
            {
                "$set": {
                    "status": update.status,
                    "notes": update.notes,
                    "next_action_date": update.next_action_date,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "history": history,
                }
            },
        )
    else:
        await db.supplier_engagements.insert_one(
            {
                "user_id": user["user_id"],
                "supplier_id": supplier_id,
                "status": update.status,
                "notes": update.notes,
                "next_action_date": update.next_action_date,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "history": [history_entry],
            }
        )

    engagement = await db.supplier_engagements.find_one(
        {"user_id": user["user_id"], "supplier_id": supplier_id},
        {"_id": 0},
    )

    return engagement


# ==================== PDF EXPORT ====================

@api_router.get("/suppliers/{supplier_id}/export-pdf")
async def export_recommendation_pdf(supplier_id: str, request: Request):
    user = await get_user_from_request(request)
    await _rate_limit_persistent(user["user_id"], action="pdf", limit=10, window_seconds=60)

    benchmark = await get_benchmark_by_supplier_identifier(supplier_id, tenant_id=user["user_id"])
    if not benchmark:
        raise HTTPException(status_code=404, detail="Supplier not found")

    recommendation = await get_or_generate_recommendation(benchmark)

    pdf_buffer = generate_pdf_report(benchmark, recommendation)
    await _log_audit(user["user_id"], "pdf.export", {"benchmark_id": benchmark["id"], "supplier_name": benchmark.get("supplier_name")})

    filename = f"recommendation_{benchmark['supplier_name'].replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def generate_pdf_report(benchmark: dict, recommendation: dict) -> BytesIO:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.units import inch

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75 * inch, bottomMargin=0.75 * inch)

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=20,
        textColor=colors.HexColor("#22C55E"),
        spaceAfter=12,
    )

    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#333333"),
        spaceBefore=16,
        spaceAfter=8,
    )

    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#555555"),
        spaceAfter=6,
        leading=14,
    )

    clause_style = ParagraphStyle(
        "ClauseStyle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#333333"),
        spaceAfter=6,
        leading=12,
        leftIndent=20,
        rightIndent=20,
        backColor=colors.HexColor("#F5F5F5"),
    )

    story = []

    story.append(Paragraph("Carbon Reduction Recommendation", title_style))
    story.append(Paragraph(f"<b>{benchmark['supplier_name']}</b>", styles["Heading2"]))
    story.append(Spacer(1, 12))

    metrics_data = [
        ["Metric", "Value"],
        ["Category", benchmark.get("category", "")],
        ["CEE Rating", benchmark.get("cee_rating", "")],
        ["Current Intensity", f"{benchmark.get('supplier_intensity', 0):.2f} kgCO2e/unit"],
        ["Target Intensity", f"{benchmark.get('peer_intensity', 0):.2f} kgCO2e/unit"],
        ["Reduction Potential", f"{benchmark.get('potential_reduction_pct', 0):.1f}%"],
        ["Upstream Impact", f"{benchmark.get('upstream_impact_pct', 0):.2f}%"],
        ["Peer Benchmark", benchmark.get("peer_name", "")],
    ]

    metrics_table = Table(metrics_data, colWidths=[2.5 * inch, 4 * inch])
    metrics_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#22C55E")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 11),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FAFAFA")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
                ("FONTSIZE", (0, 1), (-1, -1), 10),
                ("TOPPADDING", (0, 1), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
            ]
        )
    )

    story.append(metrics_table)
    story.append(Spacer(1, 20))

    story.append(Paragraph("AI Analysis", heading_style))
    story.append(Paragraph(recommendation.get("headline", "N/A"), body_style))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Case Study", heading_style))
    story.append(Paragraph(recommendation.get("case_study_summary", "N/A"), body_style))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Recommended Actions", heading_style))
    action_plan = recommendation.get("action_plan")
    if isinstance(action_plan, list):
        for action in action_plan:
            if isinstance(action, dict):
                step_text = f"<b>Step {action.get('step', '?')}: {action.get('title', 'N/A')}</b><br/>{action.get('detail', 'N/A')}"
                if action.get("citation"):
                    step_text += f"<br/><i>Source: {action.get('citation')}</i>"
                story.append(Paragraph(step_text, body_style))
                story.append(Spacer(1, 6))
    else:
        story.append(Paragraph("No peer-validated actions were found in the retrieved context.", body_style))

    story.append(Spacer(1, 12))

    story.append(Paragraph("Suggested Contract Clause", heading_style))
    story.append(Paragraph(recommendation.get("contract_clause", "N/A"), clause_style))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Feasibility Timeline", heading_style))
    story.append(Paragraph(recommendation.get("feasibility_timeline", "24-36 months"), body_style))

    story.append(Spacer(1, 30))
    footer_style = ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.grey)
    story.append(Paragraph(f"Generated by Scope3 Reduce AI Engine on {datetime.now().strftime('%B %d, %Y')}", footer_style))

    doc.build(story)
    buffer.seek(0)
    return buffer


# ==================== MOCK DATA SEED (REALISTIC + EXPLANATORY) ====================


# ==================== MEASURE: INVENTORY (MOCKED but audit-friendly) ====================

def _period_bounds(period: str) -> Tuple[datetime, datetime]:
    """Return [start, end] bounds in UTC for a few supported period shorthands."""
    now = datetime.now(timezone.utc)
    if period == "fy2024":
        start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        end = datetime(2025, 1, 1, tzinfo=timezone.utc)
        return start, end
    if period == "last_12_months":
        return now - timedelta(days=365), now
    if period == "ytd":
        start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
        return start, now
    # default
    return now - timedelta(days=365), now


def _uncertainty_for_method(method: str) -> str:
    # Simple science-based heuristic: spend-based is typically higher uncertainty.
    if method == "activity":
        return "medium"
    return "high"


def _quality_for_record(record: dict) -> str:
    # Minimal: if missing factor match, quality low.
    if record.get("factor_match") is False:
        return "low"
    if record.get("method") == "activity":
        return "medium"
    return "medium"


# ==================== EPIC I (Agent I): ANOMALY ENGINE + FIX QUEUE (MVP) ====================

ANOMALY_SEVERITIES = {"low", "medium", "high"}
ANOMALY_STATUSES = {"open", "ignored", "resolved"}


def _anomaly_id(tenant_id: str, rule_id: str, subject_type: str, subject_id: str) -> str:
    return _hash_id(tenant_id, "anomaly", rule_id, subject_type, subject_id)


async def _upsert_anomaly(rec: Dict[str, Any]) -> None:
    await db.anomalies.create_index([("tenant_id", 1), ("status", 1), ("severity", 1), ("created_at", -1)])
    await db.anomalies.create_index([("tenant_id", 1), ("rule_id", 1), ("subject_type", 1), ("subject_id", 1)])

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.anomalies.find_one({"tenant_id": rec["tenant_id"], "id": rec["id"]}, {"_id": 0, "status": 1, "resolution_note": 1, "created_at": 1})
    if existing:
        rec.setdefault("created_at", existing.get("created_at") or now)
        if existing.get("status") in {"ignored", "resolved"}:
            rec["status"] = existing["status"]
            if existing.get("resolution_note") and rec.get("resolution_note") is None:
                rec["resolution_note"] = existing.get("resolution_note")
    else:
        rec.setdefault("created_at", now)
    rec["updated_at"] = now
    await db.anomalies.replace_one({"tenant_id": rec["tenant_id"], "id": rec["id"]}, rec, upsert=True)


async def _run_anomaly_rules_for_tenant(tenant_id: str) -> int:
    """Deterministic quality checks only (no LLM). Returns number of anomalies upserted."""
    created = 0

    benchmarks = await db.supplier_benchmarks.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(2000)
    recs = await db.recommendation_content.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(3000)
    rec_by_benchmark = {r.get("benchmark_id"): r for r in recs if r.get("benchmark_id")}
    prov_recs = await db.field_provenance.find({"tenant_id": tenant_id, "entity_type": "supplier_benchmark"}, {"_id": 0, "entity_id": 1, "field_key": 1}).to_list(5000)
    prov_keys = {(p.get("entity_id"), p.get("field_key")) for p in (prov_recs or []) if p.get("entity_id") and p.get("field_key")}

    HIGH_IMPACT_MIN_PCT = 1.0
    REQUIRED_PROVENANCE_FIELDS: List[Tuple[str, str]] = [
        ("upstream_impact_pct", "Upstream impact (%)"),
        ("potential_reduction_pct", "Potential reduction (%)"),
        ("supplier_intensity", "Supplier intensity"),
        ("peer_intensity", "Peer intensity"),
        ("upstream_spend_usd_m", "Upstream spend (USD M)"),
    ]

    # Rule 1: zero/near-zero spend (data gap)
    for b in benchmarks:
        spend = float(b.get("upstream_spend_usd_m", 0.0) or 0.0)
        if spend > 0:
            continue
        anomaly = {
            "id": _anomaly_id(tenant_id, "benchmark.zero_spend", "supplier_benchmark", b["id"]),
            "tenant_id": tenant_id,
            "rule_id": "benchmark.zero_spend",
            "severity": "medium",
            "status": "open",
            "subject_type": "supplier_benchmark",
            "subject_id": b["id"],
            "subject_label": b.get("supplier_name"),
            "message": "Supplier benchmark has zero upstream spend; validate inputs or exclude from prioritization.",
            "details": {"supplier_id": b.get("supplier_id"), "category": b.get("category"), "upstream_spend_usd_m": spend},
            "fix_hint": "Add missing spend lines or activity allocation; otherwise mark ignored.",
        }
        await _upsert_anomaly(anomaly)
        created += 1

    # Rule 2b: missing field-level provenance for high-impact suppliers/fields
    for b in benchmarks:
        impact = float(b.get("upstream_impact_pct", 0.0) or 0.0)
        if impact < HIGH_IMPACT_MIN_PCT:
            continue

        severity = "high" if impact >= 2.0 else "medium"
        for field_key, field_label in REQUIRED_PROVENANCE_FIELDS:
            if b.get(field_key) is None:
                continue
            if (b.get("id"), field_key) in prov_keys:
                continue
            anomaly = {
                "id": _anomaly_id(tenant_id, f"provenance.missing.{field_key}", "supplier_benchmark_field", f"{b['id']}:{field_key}"),
                "tenant_id": tenant_id,
                "rule_id": f"provenance.missing.{field_key}",
                "severity": severity,
                "status": "open",
                "subject_type": "supplier_benchmark_field",
                "subject_id": f"{b['id']}:{field_key}",
                "subject_label": f"{b.get('supplier_name')} · {field_label}",
                "message": "High-impact benchmark field is missing evidence provenance.",
                "details": {
                    "entity_type": "supplier_benchmark",
                    "entity_id": b.get("id"),
                    "field_key": field_key,
                    "field_label": field_label,
                    "field_value": b.get(field_key),
                    "supplier_id": b.get("supplier_id"),
                    "category": b.get("category"),
                    "upstream_impact_pct": impact,
                },
                "fix_hint": "Open Evidence → Field provenance: select the supporting doc/page/block(s) and attach provenance to this field.",
            }
            await _upsert_anomaly(anomaly)
            created += 1

    # Rule 2: leader/no better peer (peer == supplier)
    for b in benchmarks:
        if (b.get("peer_id") or "") != (b.get("supplier_id") or ""):
            continue
        anomaly = {
            "id": _anomaly_id(tenant_id, "benchmark.peer_same_as_supplier", "supplier_benchmark", b["id"]),
            "tenant_id": tenant_id,
            "rule_id": "benchmark.peer_same_as_supplier",
            "severity": "low",
            "status": "open",
            "subject_type": "supplier_benchmark",
            "subject_id": b["id"],
            "subject_label": b.get("supplier_name"),
            "message": "No better peer match found (peer equals supplier).",
            "details": {"supplier_id": b.get("supplier_id"), "peer_id": b.get("peer_id"), "category": b.get("category")},
            "fix_hint": "Broaden peer matching constraints or mark as leader.",
        }
        await _upsert_anomaly(anomaly)
        created += 1

    # Rule 3: insufficient evidence for action plan
    for b in benchmarks:
        rec = rec_by_benchmark.get(b.get("id"))
        if not rec:
            continue
        evidence_status = rec.get("evidence_status", "ok")
        if evidence_status == "ok":
            continue
        impact = float(b.get("upstream_impact_pct", 0.0) or 0.0)
        severity = "high" if impact >= 1.0 else "medium"
        anomaly = {
            "id": _anomaly_id(tenant_id, "evidence.insufficient_context", "supplier_benchmark", b["id"]),
            "tenant_id": tenant_id,
            "rule_id": "evidence.insufficient_context",
            "severity": severity,
            "status": "open",
            "subject_type": "supplier_benchmark",
            "subject_id": b["id"],
            "subject_label": b.get("supplier_name"),
            "message": "Recommendation lacks peer-validated technical actions due to insufficient evidence context.",
            "details": {"evidence_status": evidence_status, "category": b.get("category"), "upstream_impact_pct": impact},
            "fix_hint": "Collect a primary supplier doc or add peer disclosures, then re-run ingestion/generation.",
        }
        await _upsert_anomaly(anomaly)
        created += 1

    # Rule 4: https sources registered but not downloaded
    sources = await db.disclosure_sources.find({"tenant_id": tenant_id, "url": {"$regex": r"^https://"}}, {"_id": 0}).to_list(2000)
    if sources:
        docs_by_url = {
            d.get("url"): d
            for d in await db.disclosure_docs.find({"tenant_id": tenant_id}, {"_id": 0, "url": 1}).to_list(3000)
            if d.get("url")
        }
        for s in sources:
            url = s.get("url")
            if not url:
                continue
            if url in docs_by_url:
                continue
            anomaly = {
                "id": _anomaly_id(tenant_id, "pipeline.source_not_downloaded", "disclosure_source", s["id"]),
                "tenant_id": tenant_id,
                "rule_id": "pipeline.source_not_downloaded",
                "severity": "medium",
                "status": "open",
                "subject_type": "disclosure_source",
                "subject_id": s["id"],
                "subject_label": s.get("title") or url,
                "message": "Registered PDF source has not been downloaded into disclosure_docs.",
                "details": {"url": url, "company_id": s.get("company_id"), "category": s.get("category")},
                "fix_hint": "Run the download job for registered https sources.",
            }
            await _upsert_anomaly(anomaly)
            created += 1

    return created


class AnomalyStatusUpdate(BaseModel):
    status: str
    resolution_note: Optional[str] = None


@api_router.post("/quality/anomalies/run")
async def run_anomalies(request: Request):
    """Run deterministic anomaly rules and upsert into anomalies collection."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _rate_limit_persistent(tenant_id, action="quality_anomalies_run", limit=4, window_seconds=60)

    count = await _run_anomaly_rules_for_tenant(tenant_id)
    await _log_audit(tenant_id, "quality.anomalies.run", {"upserted": count})
    return {"message": "Anomaly scan complete", "upserted": count}


@api_router.get("/quality/anomalies")
async def list_anomalies(request: Request, status: Optional[str] = None, severity: Optional[str] = None, limit: int = 200):
    """List anomalies for the current tenant."""
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    q: Dict[str, Any] = {"tenant_id": tenant_id}
    if status:
        q["status"] = status
    if severity:
        q["severity"] = severity

    anomalies = (
        await db.anomalies.find(q, {"_id": 0})
        .sort("updated_at", -1)
        .to_list(min(int(limit or 200), 1000))
    )
    return {"anomalies": anomalies}


@api_router.post("/quality/anomalies/{anomaly_id}/status")
async def update_anomaly_status(anomaly_id: str, payload: AnomalyStatusUpdate, request: Request):
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    if payload.status not in ANOMALY_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {sorted(ANOMALY_STATUSES)}")

    now = datetime.now(timezone.utc).isoformat()
    update = {"status": payload.status, "updated_at": now}
    if payload.resolution_note is not None:
        update["resolution_note"] = payload.resolution_note

    res = await db.anomalies.update_one({"tenant_id": tenant_id, "id": anomaly_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    await _log_audit(tenant_id, "quality.anomalies.status", {"id": anomaly_id, "status": payload.status})
    return {"message": "Updated"}


# ==================== INTEGRATIONS (CLIENT HARDCODED DEMO FLOWS) ====================

INTEGRATION_STATUSES = {"not_connected", "connected", "error"}


class IntegrationStateUpsert(BaseModel):
    connector_id: str
    status: str = "connected"
    display_name: Optional[str] = None
    config_summary: Optional[Dict[str, Any]] = None


@api_router.get("/integrations/catalog")
async def integrations_catalog(request: Request):
    """Return the demo integrations catalog (used by the frontend Integrations page)."""
    await get_user_from_request(request)
    return {"connectors": INTEGRATIONS_CATALOG}


@api_router.get("/integrations/state")
async def get_integrations_state(request: Request):
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await db.integrations_state.create_index([("tenant_id", 1), ("connector_id", 1)])
    rows = await db.integrations_state.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(200)
    return {"state": rows}


@api_router.post("/integrations/state")
async def upsert_integration_state(payload: IntegrationStateUpsert, request: Request):
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    if payload.status not in INTEGRATION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {sorted(INTEGRATION_STATUSES)}")

    await db.integrations_state.create_index([("tenant_id", 1), ("connector_id", 1)])

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.integrations_state.find_one({"tenant_id": tenant_id, "connector_id": payload.connector_id}, {"_id": 0})
    created_at = (existing or {}).get("created_at") or now

    rec = {
        "id": _hash_id(tenant_id, "integration", payload.connector_id),
        "tenant_id": tenant_id,
        "connector_id": payload.connector_id,
        "display_name": payload.display_name,
        "status": payload.status,
        "config_summary": payload.config_summary or (existing or {}).get("config_summary") or {},
        "created_at": created_at,
        "updated_at": now,
        "last_sync_at": (existing or {}).get("last_sync_at"),
    }

    await db.integrations_state.replace_one({"tenant_id": tenant_id, "connector_id": payload.connector_id}, rec, upsert=True)
    await _log_audit(tenant_id, "integrations.state.upsert", {"connector_id": payload.connector_id, "status": payload.status})
    return {"state": rec}


async def _ensure_measure_factors() -> None:
    """Upsert the minimal factor library required for Measure demo sync."""
    factors = [
        {
            "id": "ef_spend_purchased_goods_us_2024_v1",
            "method": "spend",
            "category": "Purchased Goods & Services",
            "region": "US",
            "year": 2024,
            "unit": "kgCO2e_per_usd",
            "value": 0.32,
            "source": "EPA / DEFRA blend (illustrative)",
            "version": "v1",
        },
        {
            "id": "ef_activity_freight_tkm_us_2024_v1",
            "method": "activity",
            "category": "Transport & Distribution",
            "region": "US",
            "year": 2024,
            "unit": "kgCO2e_per_tonne_km",
            "value": 0.062,
            "source": "GLEC Framework (illustrative)",
            "version": "v1",
        },
        {
            "id": "ef_activity_electricity_kwh_us_2024_v1",
            "method": "activity",
            "category": "Fuel & Energy Activities",
            "region": "US",
            "year": 2024,
            "unit": "kgCO2e_per_kwh",
            "value": 0.38,
            "source": "US eGRID (illustrative)",
            "version": "v1",
        },
    ]
    for f in factors:
        await db.measure_emission_factors.replace_one({"id": f["id"]}, f, upsert=True)


def _demo_integration_measure_rows(tenant_id: str, connector_id: str, period: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Deterministically generate a small set of Measure purchase + activity rows."""
    # Keep numeric outputs deterministic and bounded. No randomness.
    # Align supplier ids used elsewhere in the demo ({company}_001).
    purchases = [
        ("ppg_001", "PPG Industries", "Purchased Goods & Services", 260_000_000),
        ("intl_paper_001", "International Paper", "Purchased Goods & Services", 58_000_000),
        ("holcim_001", "Holcim Ltd", "Purchased Goods & Services", 44_000_000),
        ("ups_001", "UPS Logistics", "Transport & Distribution", 92_000_000),
        ("dow_001", "Dow Inc", "Fuel & Energy Activities", 75_000_000),
    ]

    activities = [
        ("ups_001", "UPS Logistics", "Transport & Distribution", "freight", "tonne_km", 620_000_000),
        ("dow_001", "Dow Inc", "Fuel & Energy Activities", "electricity", "kwh", 820_000_000),
    ]

    start, end = _period_bounds(period)
    base_date = start + timedelta(days=30)
    date_str = base_date.date().isoformat()

    purchase_rows: List[Dict[str, Any]] = []
    for idx, (sid, name, category, amount) in enumerate(purchases, start=1):
        purchase_rows.append(
            {
                "id": _hash_id(tenant_id, "integration", connector_id, "purchase", period, str(idx), sid),
                "user_id": tenant_id,
                "supplier_id": sid,
                "supplier_name": name,
                "category": category,
                "date": date_str,
                "amount_usd": amount,
                "region": "US",
                "source": f"integration:{connector_id}",
                "period": period,
            }
        )

    activity_rows: List[Dict[str, Any]] = []
    for idx, (sid, name, category, activity_type, unit, qty) in enumerate(activities, start=1):
        activity_rows.append(
            {
                "id": _hash_id(tenant_id, "integration", connector_id, "activity", period, str(idx), sid),
                "user_id": tenant_id,
                "supplier_id": sid,
                "supplier_name": name,
                "category": category,
                "date": date_str,
                "activity_type": activity_type,
                "unit": unit,
                "quantity": qty,
                "region": "US",
                "source": f"integration:{connector_id}",
                "period": period,
            }
        )

    return purchase_rows, activity_rows


@api_router.post("/integrations/{connector_id}/demo-sync")
async def integrations_demo_sync(connector_id: str, request: Request, period: str = "last_12_months"):
    """Demo-only: seed deterministic Measure inputs as if synced from an integration.

    This is designed for vendor outreach demos and is intentionally lightweight.
    """
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action=f"demo sync integration {connector_id}")
    await _ensure_measure_factors()

    # Upsert purchases/activities to avoid duplicates across repeated demo syncs.
    purchase_rows, activity_rows = _demo_integration_measure_rows(tenant_id, connector_id, period)

    await db.measure_purchases.create_index([("user_id", 1), ("id", 1)])
    await db.measure_activity.create_index([("user_id", 1), ("id", 1)])

    for r in purchase_rows:
        await db.measure_purchases.replace_one({"user_id": tenant_id, "id": r["id"]}, r, upsert=True)
    for r in activity_rows:
        await db.measure_activity.replace_one({"user_id": tenant_id, "id": r["id"]}, r, upsert=True)

    now = datetime.now(timezone.utc).isoformat()
    await db.integrations_state.create_index([("tenant_id", 1), ("connector_id", 1)])
    await db.integrations_state.update_one(
        {"tenant_id": tenant_id, "connector_id": connector_id},
        {"$set": {"last_sync_at": now, "updated_at": now, "status": "connected"}},
        upsert=True,
    )

    await _log_audit(tenant_id, "integrations.demo_sync", {"connector_id": connector_id, "period": period, "purchases": len(purchase_rows), "activities": len(activity_rows)})
    return {"message": "Demo sync complete", "connector_id": connector_id, "period": period, "counts": {"purchases": len(purchase_rows), "activities": len(activity_rows)}}


# ==================== EPIC I: ADMIN ENDPOINTS (MVP) ====================

@api_router.get("/admin/audit")
async def admin_audit(request: Request, limit: int = 50):
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    events = (
        await db.audit_events.find({"user_id": tenant_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return {"events": events}


@api_router.get("/admin/metrics")
async def admin_metrics(request: Request):
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    suppliers = await db.supplier_benchmarks.count_documents({"tenant_id": tenant_id})
    recs = await db.recommendation_content.count_documents({"tenant_id": tenant_id})
    docs = await db.disclosure_docs.count_documents({"tenant_id": tenant_id})
    sources = await db.disclosure_sources.count_documents({"tenant_id": tenant_id})
    chunks = await db.disclosure_chunks.count_documents({"tenant_id": tenant_id})

    last_run = await db.pipeline_runs.find_one({"tenant_id": tenant_id}, {"_id": 0}, sort=[("started_at", -1)])

    return {
        "tenant_id": tenant_id,
        "counts": {
            "benchmarks": suppliers,
            "recommendations": recs,
            "sources": sources,
            "docs": docs,
            "chunks": chunks,
        },
        "last_pipeline_run": last_run,
    }


# ==================== EPIC D/I: SCHEDULER (MVP) ====================

async def _nightly_pipeline_job():
    # Runs for demo tenant only if present.
    # In production this would iterate orgs.
    try:
        # No user context; skip.
        return
    except Exception:
        return


@app.on_event("startup")
async def startup_scheduler():
    global scheduler
    if scheduler:
        return

    scheduler = AsyncIOScheduler()
    # Nightly at 02:15 UTC (MVP). Does nothing until we implement org iteration.
    scheduler.add_job(_nightly_pipeline_job, CronTrigger(hour=2, minute=15))
    scheduler.start()


@api_router.post("/measure/seed")
async def seed_measure_data(request: Request, period: str = "last_12_months"):
    """Seed realistic Measure inputs: purchases + activity + emission factors.

    This is an audit-friendly mock:
    - Purchases simulate general ledger spend lines
    - Activities simulate logistics tonne-km and electricity kWh
    - Emission factors include source, region, year, unit, version
    """
    await get_user_from_request(request)

    user = await get_user_from_request(request)
    user_id = user["user_id"]

    await _enforce_reporting_period_unlocked(user_id, period, action="seed measure data")

    await db.measure_purchases.delete_many({"user_id": user_id})
    await db.measure_activity.delete_many({"user_id": user_id})

    # Factors are global in this MVP (public methodology library). We upsert by id below.

    factors = [
        {
            "id": "ef_spend_purchased_goods_us_2024_v1",
            "method": "spend",
            "category": "Purchased Goods & Services",
            "region": "US",
            "year": 2024,
            "unit": "kgCO2e_per_usd",
            "value": 0.35,
            "source": "EXIOBASE (illustrative)",
            "version": "v1",
        },
        {
            "id": "ef_spend_fuel_energy_us_2024_v1",
            "method": "spend",
            "category": "Fuel & Energy Activities",
            "region": "US",
            "year": 2024,
            "unit": "kgCO2e_per_usd",
            "value": 0.50,
            "source": "IEA / MRIO blend (illustrative)",
            "version": "v1",
        },
        {
            "id": "ef_spend_transport_us_2024_v1",
            "method": "spend",
            "category": "Transport & Distribution",
            "region": "US",
            "year": 2024,
            "unit": "kgCO2e_per_usd",
            "value": 0.22,
            "source": "EPA / DEFRA blend (illustrative)",
            "version": "v1",
        },
        {
            "id": "ef_activity_freight_tkm_us_2024_v1",
            "method": "activity",
            "category": "Transport & Distribution",
            "region": "US",
            "year": 2024,
            "unit": "kgCO2e_per_tonne_km",
            "value": 0.062,
            "source": "GLEC Framework (illustrative)",
            "version": "v1",
        },
        {
            "id": "ef_activity_electricity_kwh_us_2024_v1",
            "method": "activity",
            "category": "Fuel & Energy Activities",
            "region": "US",
            "year": 2024,
            "unit": "kgCO2e_per_kwh",
            "value": 0.38,
            "source": "US eGRID (illustrative)",
            "version": "v1",
        },
    ]

    for f in factors:
        await db.measure_emission_factors.replace_one({"id": f["id"]}, f, upsert=True)

    # Align with Reduce suppliers seeded by /seed-data
    # Use same supplier IDs from the Reduce benchmark seed pattern: {company_id}_001
    purchases = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "supplier_id": "ppg_001",
            "supplier_name": "PPG Industries",
            "category": "Purchased Goods & Services",
            "date": "2024-06-30",
            "amount_usd": 420_000_000,
            "region": "US",
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "supplier_id": "intl_paper_001",
            "supplier_name": "International Paper",
            "category": "Purchased Goods & Services",
            "date": "2024-05-20",
            "amount_usd": 75_000_000,
            "region": "US",
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "supplier_id": "holcim_001",
            "supplier_name": "Holcim Ltd",
            "category": "Purchased Goods & Services",
            "date": "2024-04-12",
            "amount_usd": 55_000_000,
            "region": "US",
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "supplier_id": "dow_001",
            "supplier_name": "Dow Inc",
            "category": "Fuel & Energy Activities",
            "date": "2024-07-02",
            "amount_usd": 120_000_000,
            "region": "US",
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "supplier_id": "ups_001",
            "supplier_name": "UPS Logistics",
            "category": "Transport & Distribution",
            "date": "2024-03-01",
            "amount_usd": 180_000_000,
            "region": "US",
        },
        # Edge cases
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "supplier_id": "fedex_001",
            "supplier_name": "FedEx Corporation",
            "category": "Transport & Distribution",
            "date": "2024-02-01",
            "amount_usd": 0,
            "region": "US",
        },
    ]

    activities = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "supplier_id": "ups_001",
            "supplier_name": "UPS Logistics",
            "category": "Transport & Distribution",
            "date": "2024-03-15",
            "activity_type": "freight",
            "unit": "tonne_km",
            "quantity": 950_000_000,
            "region": "US",
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "supplier_id": "dow_001",
            "supplier_name": "Dow Inc",
            "category": "Fuel & Energy Activities",
            "date": "2024-07-01",
            "activity_type": "electricity",
            "unit": "kwh",
            "quantity": 1_800_000_000,
            "region": "US",
        },
    ]

    await db.measure_purchases.insert_many(purchases)
    await db.measure_activity.insert_many(activities)

    return {
        "message": "Measure mock data seeded",
        "counts": {"emission_factors": len(factors), "purchases": len(purchases), "activities": len(activities)},
        "note": "Spend-based + activity-based rows are seeded with factor provenance and simple uncertainty flags.",
    }


async def _factor_lookup(method: str, category: str, region: str, year: int) -> Optional[dict]:
    return await db.measure_emission_factors.find_one(
        {"method": method, "category": category, "region": region, "year": year},
        {"_id": 0},
    )


def _safe_div(n: float, d: float) -> float:
    return (n / d) if d else 0.0


async def _measure_total_upstream_tco2e(user_id: str, period: str = "last_12_months") -> float:
    inv = await _compute_inventory(period, user_id=user_id)
    return float(inv.get("total_upstream_tco2e", 0.0) or 0.0)


async def _measure_supplier_tco2e_by_supplier_id(user_id: str, period: str = "last_12_months") -> Dict[str, float]:
    inv = await _compute_inventory(period, user_id=user_id)
    return {s["supplier_id"]: float(s.get("tco2e", 0.0) or 0.0) for s in inv.get("top_suppliers", [])}


async def _compute_inventory(period: str, user_id: str = "_global_demo") -> Dict[str, Any]:
    start, end = _period_bounds(period)

    # NOTE: dates stored as strings for mock simplicity. Filter by prefix year for now.
    year = 2024

    # Partition by user for MVP (multi-tenant readiness)
    purchases = await db.measure_purchases.find({"user_id": user_id}, {"_id": 0}).to_list(5000)
    activities = await db.measure_activity.find({"user_id": user_id}, {"_id": 0}).to_list(5000)

    line_items: List[Dict[str, Any]] = []

    # Spend-based
    for p in purchases:
        amount = float(p.get("amount_usd", 0) or 0)
        category = p.get("category")
        region = p.get("region", "US")

        factor = await _factor_lookup("spend", category, region, year)
        if not factor:
            line_items.append(
                {
                    **p,
                    "method": "spend",
                    "tco2e": 0.0,
                    "factor_match": False,
                    "factor": None,
                    "uncertainty": _uncertainty_for_method("spend"),
                    "data_quality": "low",
                }
            )
            continue

        kg = amount * float(factor["value"])  # kgCO2e
        tco2e = kg / 1000.0

        line_items.append({
            **p,
            "method": "spend",
            "tco2e": tco2e,
            "factor_match": True,
            "factor": factor,
            "uncertainty": _uncertainty_for_method("spend"),
            "data_quality": "medium",
        })

    # Activity-based
    for a in activities:
        qty = float(a.get("quantity", 0) or 0)
        category = a.get("category")
        region = a.get("region", "US")

        factor = None
        if a.get("unit") == "tonne_km":
            factor = await _factor_lookup("activity", "Transport & Distribution", region, year)
        elif a.get("unit") == "kwh":
            factor = await _factor_lookup("activity", "Fuel & Energy Activities", region, year)

        if not factor:
            line_items.append({
                **a,
                "method": "activity",
                "tco2e": 0.0,
                "factor_match": False,
                "factor": None,
                "uncertainty": _uncertainty_for_method("activity"),
                "data_quality": "low",
            })
            continue

        kg = qty * float(factor["value"])
        tco2e = kg / 1000.0

        line_items.append({
            **a,
            "method": "activity",
            "tco2e": tco2e,
            "factor_match": True,
            "factor": factor,
            "uncertainty": _uncertainty_for_method("activity"),
            "data_quality": "medium",
        })

    total = sum(li.get("tco2e", 0.0) for li in line_items)
    matched = [li for li in line_items if li.get("factor_match")]
    coverage = (sum(li.get("tco2e", 0.0) for li in matched) / total * 100.0) if total > 0 else 0.0

    by_category: Dict[str, float] = {}
    for li in line_items:
        cat = li.get("category")
        by_category[cat] = by_category.get(cat, 0.0) + float(li.get("tco2e", 0.0) or 0)

    # Supplier rollups
    supplier_rollup: Dict[str, Dict[str, Any]] = {}
    for li in line_items:
        sid = li.get("supplier_id")
        if not sid:
            continue
        rec = supplier_rollup.setdefault(sid, {
            "supplier_id": sid,
            "supplier_name": li.get("supplier_name"),
            "tco2e": 0.0,
            "spend_usd": 0.0,
            "activity_tco2e": 0.0,
            "spend_tco2e": 0.0,
            "uncertainty": "high",
            "data_quality": "medium",
        })

        rec["tco2e"] += float(li.get("tco2e", 0.0) or 0)
        if li.get("method") == "spend":
            rec["spend_usd"] += float(li.get("amount_usd", 0.0) or 0)
            rec["spend_tco2e"] += float(li.get("tco2e", 0.0) or 0)
        else:
            rec["activity_tco2e"] += float(li.get("tco2e", 0.0) or 0)

        # escalate quality if any low lines
        if li.get("data_quality") == "low":
            rec["data_quality"] = "low"
        # uncertainty: activity-only suppliers become medium
        if rec["spend_tco2e"] == 0 and rec["activity_tco2e"] > 0:
            rec["uncertainty"] = "medium"

    suppliers_sorted = sorted(supplier_rollup.values(), key=lambda r: r.get("tco2e", 0), reverse=True)

    # Intensity (tCO2e per $) for suppliers that have spend
    for s in suppliers_sorted:
        spend = float(s.get("spend_usd", 0.0) or 0)
        s["intensity_tco2e_per_usd"] = (s.get("tco2e", 0.0) / spend) if spend > 0 else None

    return {
        "period": period,
        "total_upstream_tco2e": total,
        "coverage_pct": round(coverage, 1),
        "category_breakdown": [
            {
                "entity_type": "measure_category",
                "entity_id": _measure_entity_id(user_id, period, "category", k),
                "category": k,
                "tco2e": round(v, 2),
            }
            for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
        ],
        "top_suppliers": [
            {
                "entity_type": "measure_supplier",
                "entity_id": _measure_entity_id(user_id, period, "supplier", s["supplier_id"]),
                "supplier_id": s["supplier_id"],
                "supplier_name": s["supplier_name"],
                "tco2e": round(s["tco2e"], 2),
                "spend_usd": round(s["spend_usd"], 2),
                "intensity_tco2e_per_usd": s["intensity_tco2e_per_usd"],
                "uncertainty": s["uncertainty"],
                "data_quality": s["data_quality"],
            }
            for s in suppliers_sorted[:20]
        ],
        "notes": {
            "methodology": "Spend-based + activity-based. Factors applied by (method, category, region, year).",
            "uncertainty_model": "Spend=high uncertainty; activity=medium; missing factors=low data quality.",
        },
    }


@api_router.get("/measure/overview")
async def measure_overview(request: Request, period: str = "last_12_months"):
    user = await get_user_from_request(request)
    return await _compute_inventory(period, user_id=user["user_id"])


@api_router.get("/measure/suppliers")
async def measure_suppliers(request: Request, period: str = "last_12_months"):
    user = await get_user_from_request(request)
    inv = await _compute_inventory(period, user_id=user["user_id"])
    return {"period": inv["period"], "top_suppliers": inv["top_suppliers"], "coverage_pct": inv["coverage_pct"]}


async def _seed_engagement_records(tenant_id: str, benchmarks: list):
    """Pre-seed engagement records so the Engage table is populated on first load."""
    if not benchmarks:
        return
    statuses = ["not_started", "in_progress", "pending_response", "completed", "not_started"]
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for i, b in enumerate(benchmarks):
        status = statuses[i % len(statuses)]
        docs.append({
            "user_id": tenant_id,
            "supplier_id": b["id"],
            "status": status,
            "notes": None,
            "next_action_date": None,
            "created_at": now,
            "updated_at": now,
            "history": [{"status": status, "notes": None, "timestamp": now}],
        })
    await db.supplier_engagements.delete_many({"user_id": tenant_id})
    await db.supplier_engagements.insert_many(docs)


@api_router.post("/seed-data")
async def seed_mock_data(request: Request, period: str = "last_12_months"):
    """Seed the database with realistic mock benchmarks + disclosure chunks.

    NOTE: This is a MOCK precomputed pipeline. In production this would be generated by batch jobs.

    This simulates the output of the precomputed pipeline using the peer-matching rules:
    - same ISIC (4-digit)
    - revenue within 0.5x to 2.0x
    - select peer with lowest intensity in category
    """
    await get_user_from_request(request)

    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action="seed pipeline data")

    await db.supplier_benchmarks.delete_many({"tenant_id": tenant_id})
    await db.recommendation_content.delete_many({"tenant_id": tenant_id})
    await db.supplier_engagements.delete_many({"user_id": tenant_id})
    await db.anomalies.delete_many({"tenant_id": tenant_id})

    # disclosure_chunks are treated as public/peer evidence and are global in this demo.
    if await db.disclosure_chunks.estimated_document_count() == 0:
        await db.disclosure_chunks.delete_many({})

    # Company universe (mock “1M disclosures” reduced to a small realistic sample)
    companies = [
        {"company_id": "ppg", "name": "PPG Industries", "isic": "2010", "sector": "Chemicals & Coatings", "revenue_m": 18000},
        {"company_id": "sika", "name": "Sika AG", "isic": "2010", "sector": "Chemicals & Coatings", "revenue_m": 11000},
        {"company_id": "basf", "name": "BASF SE", "isic": "2010", "sector": "Chemicals & Coatings", "revenue_m": 80000},
        {"company_id": "dow", "name": "Dow Inc", "isic": "2010", "sector": "Chemicals & Coatings", "revenue_m": 45000},

        {"company_id": "dhl", "name": "DHL Express", "isic": "4923", "sector": "Logistics", "revenue_m": 95000},
        {"company_id": "ups", "name": "UPS Logistics", "isic": "4923", "sector": "Logistics", "revenue_m": 92000},
        {"company_id": "fedex", "name": "FedEx Corporation", "isic": "4923", "sector": "Logistics", "revenue_m": 88000},

        {"company_id": "heidelberg", "name": "Heidelberg Materials", "isic": "2394", "sector": "Cement & Aggregates", "revenue_m": 22000},
        {"company_id": "holcim", "name": "Holcim Ltd", "isic": "2394", "sector": "Cement & Aggregates", "revenue_m": 29000},

        {"company_id": "nucor", "name": "Nucor Steel", "isic": "2410", "sector": "Steel Production", "revenue_m": 33000},
        {"company_id": "ssab", "name": "SSAB AB", "isic": "2410", "sector": "Steel Production", "revenue_m": 12000},
        {"company_id": "arcelor", "name": "ArcelorMittal", "isic": "2410", "sector": "Steel Production", "revenue_m": 79000},

        {"company_id": "stora", "name": "Stora Enso", "isic": "1701", "sector": "Paper & Packaging", "revenue_m": 12000},
        {"company_id": "intl_paper", "name": "International Paper", "isic": "1701", "sector": "Paper & Packaging", "revenue_m": 21000},
    ]

    company_map = {c["company_id"]: c for c in companies}

    # Category intensity profiles (kgCO2e per revenue unit, mocked but consistent)
    intensity = {
        "Purchased Goods & Services": {
            "ppg": 0.45,
            "sika": 0.35,
            "basf": 0.48,
            "dow": 0.52,
            "nucor": 0.28,
            "ssab": 0.19,
            "arcelor": 0.34,
            "holcim": 0.82,
            "heidelberg": 0.65,
            "intl_paper": 0.48,
            "stora": 0.36,
        },
        "Transport & Distribution": {
            "ups": 0.32,
            "dhl": 0.27,
            "fedex": 0.41,
        },
        "Fuel & Energy Activities": {
            "dow": 0.58,
            "basf": 0.47,
            "ppg": 0.51,
            "sika": 0.44,
        },
    }

    def revenue_band(rev_m: float) -> str:
        if rev_m >= 100000:
            return "$100B+"
        if rev_m >= 50000:
            return "$50B+"
        if rev_m >= 20000:
            return "$20B-$50B"
        if rev_m >= 10000:
            return "$10B-$20B"
        return "<$10B"

    def pick_peer(supplier_company_id: str, category: str) -> Optional[str]:
        supplier = company_map[supplier_company_id]
        supplier_rev = supplier["revenue_m"]
        supplier_isic = supplier["isic"]
        supplier_int = intensity.get(category, {}).get(supplier_company_id)
        if supplier_int is None:
            return None

        candidates = []
        for cid, val in intensity.get(category, {}).items():
            if cid == supplier_company_id:
                continue
            peer = company_map.get(cid)
            if not peer:
                continue
            if peer["isic"] != supplier_isic:
                continue
            if not (0.5 * supplier_rev <= peer["revenue_m"] <= 2.0 * supplier_rev):
                continue
            if val >= supplier_int:
                continue
            candidates.append((val, cid))

        if not candidates:
            return None

        candidates.sort(key=lambda x: x[0])
        return candidates[0][1]

    # User-specific supplier set (triage list). Include 2 edge cases:
    # - leader (no better peer)
    # - zero spend
    user_suppliers = [
        {"company_id": "ppg", "category": "Purchased Goods & Services", "spend_m": 420},
        {"company_id": "ups", "category": "Transport & Distribution", "spend_m": 180},
        {"company_id": "dow", "category": "Fuel & Energy Activities", "spend_m": 120},
        {"company_id": "intl_paper", "category": "Purchased Goods & Services", "spend_m": 75},
        {"company_id": "holcim", "category": "Purchased Goods & Services", "spend_m": 55},
        # Edge cases
        {"company_id": "ssab", "category": "Purchased Goods & Services", "spend_m": 60},  # likely leader
        {"company_id": "fedex", "category": "Transport & Distribution", "spend_m": 0},  # zero spend
    ]

    # Compute upstream impact relative to measured baseline (Measure module)
    measure_period = "last_12_months"
    user = await get_user_from_request(request)
    measure_user_id = user["user_id"]
    total_upstream_tco2e = await _measure_total_upstream_tco2e(measure_user_id, measure_period)
    supplier_tco2e_map = await _measure_supplier_tco2e_by_supplier_id(measure_user_id, measure_period)

    benchmarks: List[Dict[str, Any]] = []
    for s in user_suppliers:
        supplier_company_id = s["company_id"]
        category = s["category"]

        peer_company_id = pick_peer(supplier_company_id, category)
        if not peer_company_id:
            # keep record for realism, but it will be excluded by default queries
            peer_company_id = supplier_company_id

        supplier_int = intensity.get(category, {}).get(supplier_company_id, 0.5)
        peer_int = intensity.get(category, {}).get(peer_company_id, supplier_int)

        potential_reduction_pct = 0.0
        if supplier_int > 0 and supplier_int > peer_int:
            potential_reduction_pct = round(((supplier_int - peer_int) / supplier_int) * 100.0, 1)

        supplier_identifier = f"{supplier_company_id}_001"
        supplier_emissions_share = _safe_div(supplier_tco2e_map.get(supplier_identifier, 0.0), total_upstream_tco2e)
        upstream_impact_pct = round(supplier_emissions_share * (potential_reduction_pct / 100.0) * 100.0, 2)

        supplier_company = company_map[supplier_company_id]
        peer_company = company_map[peer_company_id]

        # Simple CEE rating heuristic for mock display
        if potential_reduction_pct >= 30:
            cee = "D+"
        elif potential_reduction_pct >= 20:
            cee = "C-"
        elif potential_reduction_pct >= 10:
            cee = "B"
        else:
            cee = "A-"

        benchmarks.append(
            {
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "supplier_id": f"{supplier_company_id}_001",
                "supplier_name": supplier_company["name"],
                "peer_id": f"{peer_company_id}_001",
                "peer_name": peer_company["name"],
                "category": category,
                "cee_rating": cee,
                "supplier_intensity": float(supplier_int),
                "peer_intensity": float(peer_int),
                "potential_reduction_pct": float(potential_reduction_pct),
                "upstream_impact_pct": float(upstream_impact_pct),
                "industry_sector": supplier_company["sector"],
                "isic_code": supplier_company["isic"],
                "supplier_revenue_usd_m": float(supplier_company["revenue_m"]),
                "peer_revenue_usd_m": float(peer_company["revenue_m"]),
                "revenue_band": revenue_band(supplier_company["revenue_m"]),
                "comparison_year": "2024",
                "upstream_spend_usd_m": float(s["spend_m"]),
            }
        )

    if benchmarks:
        await db.supplier_benchmarks.insert_many(benchmarks)

    # ---- Seed engagement records for each benchmark supplier ----
    await _seed_engagement_records(tenant_id, benchmarks)

    # Evidence chunks per peer + category (simulates scraping/summarizing PDF reports)
    chunks = [
        {
            "company_id": "sika_001",
            "category": "Purchased Goods & Services",
            "title": "Sika Sustainability Report 2023",
            "url": "https://example.com/reports/sika-sustainability-2023.pdf",
            "page": 45,
            "excerpt": "In 2022/2023, Sika reduced product carbon intensity by expanding bio-based polymer inputs and increasing post-consumer recycled (PCR) content in packaging to 80%.",
        },
        {
            "company_id": "sika_001",
            "category": "Purchased Goods & Services",
            "title": "Sika Sustainability Report 2023",
            "url": "https://example.com/reports/sika-sustainability-2023.pdf",
            "page": 46,
            "excerpt": "Sika implemented supplier specifications requiring minimum recycled content thresholds and audited tier-2 chemical inputs for lifecycle emissions hotspots.",
        },
        {
            "company_id": "dhl_001",
            "category": "Transport & Distribution",
            "title": "DHL ESG Report 2023",
            "url": "https://example.com/reports/dhl-esg-2023.pdf",
            "page": 12,
            "excerpt": "DHL deployed electric delivery vehicles in dense urban routes and used route-optimization software to reduce empty miles and fuel burn.",
        },
        {
            "company_id": "dhl_001",
            "category": "Transport & Distribution",
            "title": "DHL ESG Report 2023",
            "url": "https://example.com/reports/dhl-esg-2023.pdf",
            "page": 13,
            "excerpt": "For long-haul air freight, DHL increased Sustainable Aviation Fuel (SAF) procurement and shifted eligible lanes to intermodal rail alternatives.",
        },
        {
            "company_id": "basf_001",
            "category": "Fuel & Energy Activities",
            "title": "BASF Annual Report 2023",
            "url": "https://example.com/reports/basf-annual-2023.pdf",
            "page": 88,
            "excerpt": "BASF expanded renewable electricity procurement via Power Purchase Agreements (PPAs) and electrified steam generation to reduce upstream energy intensity.",
        },
        {
            "company_id": "basf_001",
            "category": "Fuel & Energy Activities",
            "title": "BASF Annual Report 2023",
            "url": "https://example.com/reports/basf-annual-2023.pdf",
            "page": 89,
            "excerpt": "BASF implemented heat integration and process optimization in energy-intensive units, prioritizing sites with highest marginal abatement potential.",
        },
        {
            "company_id": "stora_001",
            "category": "Purchased Goods & Services",
            "title": "Stora Enso Sustainability Report 2023",
            "url": "https://example.com/reports/stora-enso-sustainability-2023.pdf",
            "page": 27,
            "excerpt": "Stora Enso increased recycled fiber sourcing and switched key mills to renewable electricity contracts, reducing packaging input intensity year-over-year.",
        },
        {
            "company_id": "heidelberg_001",
            "category": "Purchased Goods & Services",
            "title": "Heidelberg Materials Climate Report 2023",
            "url": "https://example.com/reports/heidelberg-climate-2023.pdf",
            "page": 61,
            "excerpt": "Heidelberg Materials reduced clinker factor through supplementary cementitious materials (SCM) substitution and piloted CCUS at priority kilns.",
        },
    ]

    if await db.disclosure_chunks.estimated_document_count() == 0:
        await db.disclosure_chunks.insert_many(chunks)

    # Re-generate anomalies for the freshly seeded benchmarks
    anomaly_count = await _run_anomaly_rules_for_tenant(tenant_id)

    return {"message": "Mock data seeded successfully", "count": len(benchmarks), "engagements": len(benchmarks), "anomalies": anomaly_count, "note": "Includes edge cases (leader + zero spend) which are excluded by default views. Engagement records seeded for all suppliers."}


@api_router.post("/pipeline/run")
async def run_mock_pipeline(request: Request, period: str = "last_12_months"):
    """Pipeline trigger (demo): seeds baseline + benchmarks and generates cached recommendations.

    Simulates the nightly batch pipeline described in the tech spec.
    """
    user = await get_user_from_request(request)
    tenant_id = user["user_id"]

    await _enforce_reporting_period_unlocked(tenant_id, period, action="run pipeline")

    await db.pipeline_runs.create_index([("tenant_id", 1), ("started_at", -1)])

    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()
    await db.pipeline_runs.insert_one({
        "id": run_id,
        "tenant_id": tenant_id,
        "status": "running",
        "started_at": started_at,
    })

    try:
        await seed_measure_data(request, period=period)
        await seed_disclosure_sources(request, period=period)
        await ingest_disclosures(request, period=period)
        await seed_mock_data(request, period=period)
        await generate_recommendations_batch(request, period=period)

        finished_at = datetime.now(timezone.utc).isoformat()
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "success", "finished_at": finished_at}},
        )

        return {
            "message": "Pipeline run complete",
            "run_id": run_id,
            "note": "Seeded Measure + Reduce benchmarks + evidence chunks + cached recommendations.",
        }
    except Exception as e:
        finished_at = datetime.now(timezone.utc).isoformat()
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "finished_at": finished_at, "error": str(e)}},
        )
        raise


# ==================== BASIC ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Scope 3 Reduce API", "version": "1.0.0"}


@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


app.include_router(api_router)

cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
if os.environ.get("CORS_ORIGINS", "*") == "*":
    # Credentials + wildcard origin is blocked by browsers. Default to localhost dev origin.
    cors_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _maybe_mount_frontend() -> None:
    """Serve a built frontend (CRA) from the backend origin for local demos.

    Enable by setting SERVE_FRONTEND_DIR to the CRA build directory (e.g. ../frontend/build).
    """
    build_dir = os.environ.get("SERVE_FRONTEND_DIR")
    if not build_dir:
        return

    build_path = Path(build_dir).expanduser().resolve()
    index_path = build_path / "index.html"
    if not index_path.exists():
        logger.warning(f"SERVE_FRONTEND_DIR set but index.html not found: {index_path}")
        return

    def _safe_static_path(full_path: str) -> Optional[Path]:
        # Reject traversal and weird paths.
        if not full_path or full_path.startswith("/"):
            return None
        if "\x00" in full_path:
            return None
        try:
            p = (build_path / full_path).resolve()
        except Exception:
            return None
        if build_path not in p.parents and p != build_path:
            return None
        if not p.is_file():
            return None
        return p

    @app.get("/", include_in_schema=False)
    async def spa_root():
        return FileResponse(str(index_path))

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_router(full_path: str):
        # Let API routes 404 normally (so missing endpoints are obvious).
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        static_path = _safe_static_path(full_path)
        if static_path is not None:
            return FileResponse(str(static_path))

        # SPA fallback for client-side routing (e.g. /dashboard)
        return FileResponse(str(index_path))


_maybe_mount_frontend()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
