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
    supplier = benchmark.get("supplier_name", "Supplier")
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

@api_router.post("/seed-data")
async def seed_mock_data():
    """Seed the database with realistic mock benchmarks + disclosure chunks.

    This simulates the output of the precomputed pipeline using the peer-matching rules:
    - same ISIC (4-digit)
    - revenue within 0.5x..2.0x
    - select peer with lowest intensity in category
    """

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

    total_spend = sum(s["spend_m"] for s in user_suppliers) or 1

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

        spend_share = (s["spend_m"] / total_spend) if total_spend else 0
        upstream_impact_pct = round(spend_share * (potential_reduction_pct / 100.0) * 100.0, 2)

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
    """Mock pipeline trigger (re-seeds the precomputed tables)."""
    await get_user_from_request(request)
    return await seed_mock_data()


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
