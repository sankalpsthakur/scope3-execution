from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, Tuple
import uuid
from datetime import datetime, timezone, timedelta
import httpx

from fastapi.responses import StreamingResponse
from io import BytesIO

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


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

        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60,
        )

        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        return {"user": user_doc, "session_token": session_token}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/auth/me")
async def get_current_user(request: Request):
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

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")



# ==================== PROD READINESS HELPERS (AUDIT + RATE LIMIT) ====================

_rate_state: Dict[str, List[float]] = {}


def _rate_limit(key: str, limit: int, window_seconds: int = 60) -> None:
    """Very small in-memory rate limiter (single-process)."""
    import time

    now = time.time()
    bucket = _rate_state.setdefault(key, [])
    bucket[:] = [t for t in bucket if now - t < window_seconds]
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    bucket.append(now)


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

    return user_doc


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})

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

async def build_evidence_context(peer_id: str, category: str) -> Tuple[str, List[Dict[str, Any]]]:
    chunks = await db.disclosure_chunks.find(
        {"company_id": peer_id, "category": category},
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
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json

        api_key = os.environ.get("EMERGENT_LLM_KEY")

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

        chat = LlmChat(
            api_key=api_key,
            session_id=f"action_extractor_{benchmark['id']}",
            system_message=system_prompt,
        ).with_model("gemini", "gemini-3-flash-preview")

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
        logger.error(f"AI generation error: {e}")
        return build_generic_recommendation_template(benchmark, "insufficient_context")


async def get_or_generate_recommendation(benchmark: dict) -> dict:
    cached = await db.recommendation_content.find_one({"benchmark_id": benchmark["id"]}, {"_id": 0})
    if cached:
        return cached

    raw_context, citations = await build_evidence_context(benchmark["peer_id"], benchmark["category"])
    if not raw_context.strip():
        return build_generic_recommendation_template(benchmark, "missing_public_report")

    recommendation = await generate_ai_recommendation(benchmark, raw_context, citations)

    await db.recommendation_content.replace_one(
        {"benchmark_id": benchmark["id"]},
        {**recommendation, "benchmark_id": benchmark["id"]},
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


async def get_benchmark_by_supplier_identifier(supplier_identifier: str) -> Optional[dict]:
    benchmark = await db.supplier_benchmarks.find_one({"id": supplier_identifier}, {"_id": 0})
    if benchmark:
        return benchmark
    return await db.supplier_benchmarks.find_one({"supplier_id": supplier_identifier}, {"_id": 0})


# ==================== SUPPLIER ENDPOINTS ====================

@api_router.get("/suppliers")
async def get_suppliers(request: Request):
    """Top Reduction Actions table (default excludes leaders + zero impact)."""
    await get_user_from_request(request)

    base_query: Dict[str, Any] = {
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

    query: Dict[str, Any] = {
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

    base_query: Dict[str, Any] = {
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
    await get_user_from_request(request)

    benchmark = await get_benchmark_by_supplier_identifier(supplier_id)
    if not benchmark:
        raise HTTPException(status_code=404, detail="Supplier not found")

    recommendation = await get_or_generate_recommendation(benchmark)
    return build_deep_dive_response(benchmark, recommendation)


@api_router.get("/v1/recommendations/supplier/{supplier_id}/deep-dive")
async def get_supplier_deep_dive_v1(supplier_id: str, request: Request):
    """Tech-spec endpoint: returns the engineering handover contract JSON."""
    await get_user_from_request(request)

    benchmark = await get_benchmark_by_supplier_identifier(supplier_id)
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

    existing = await db.supplier_engagements.find_one({"user_id": user["user_id"], "supplier_id": supplier_id})

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
    await get_user_from_request(request)

    benchmark = await get_benchmark_by_supplier_identifier(supplier_id)
    if not benchmark:
        raise HTTPException(status_code=404, detail="Supplier not found")

    recommendation = await get_or_generate_recommendation(benchmark)

    pdf_buffer = generate_pdf_report(benchmark, recommendation)

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


@api_router.post("/measure/seed")
async def seed_measure_data(request: Request):
    """Seed realistic Measure inputs: purchases + activity + emission factors.

    This is an audit-friendly mock:
    - Purchases simulate general ledger spend lines
    - Activities simulate logistics tonne-km and electricity kWh
    - Emission factors include source, region, year, unit, version
    """
    await get_user_from_request(request)

    user = await get_user_from_request(request)
    user_id = user["user_id"]

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
        "category_breakdown": [{"category": k, "tco2e": round(v, 2)} for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)],
        "top_suppliers": [
            {
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


@api_router.post("/seed-data")
async def seed_mock_data(request: Request):
    """Seed the database with realistic mock benchmarks + disclosure chunks.

    NOTE: This is a MOCK precomputed pipeline. In production this would be generated by batch jobs.

    This simulates the output of the precomputed pipeline using the peer-matching rules:
    - same ISIC (4-digit)
    - revenue within 0.5x to 2.0x
    - select peer with lowest intensity in category
    """
    await get_user_from_request(request)

    # NOTE: Benchmarks are demo-global today; in production these must be org/user partitioned.
    await db.supplier_benchmarks.delete_many({})
    await db.recommendation_content.delete_many({})
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

    await db.disclosure_chunks.insert_many(chunks)

    return {"message": "Mock data seeded successfully", "count": len(benchmarks), "note": "Includes edge cases (leader + zero spend) which are excluded by default views."}


@api_router.post("/pipeline/run")
async def run_mock_pipeline(request: Request):
    """Mock pipeline trigger (re-seeds Measure + Reduce precomputed tables).

    This simulates the nightly batch pipeline described in the tech spec.
    """
    await get_user_from_request(request)
    await seed_measure_data(request)
    return await seed_mock_data(request)


# ==================== BASIC ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Scope 3 Reduce API", "version": "1.0.0"}


@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
