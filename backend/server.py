from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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
    supplier_id: str
    supplier_name: str
    peer_id: str
    peer_name: str
    category: str
    cee_rating: str
    supplier_intensity: float
    peer_intensity: float
    potential_reduction_pct: float
    upstream_impact_pct: float
    industry_sector: str
    revenue_band: str

class ActionStep(BaseModel):
    step: int
    title: str
    detail: str
    citation: Optional[str] = None

class RecommendationContent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    benchmark_id: str
    headline: str
    action_plan: List[ActionStep]
    case_study_summary: str
    contract_clause: str
    source_citations: List[Dict[str, str]]
    feasibility_timeline: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeepDiveResponse(BaseModel):
    meta: Dict[str, Any]
    metrics: Dict[str, Any]
    content: Dict[str, Any]

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Process session_id from Emergent Auth and create local session"""
    try:
        body = await request.json()
        session_id = body.get("session_id")
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")
        
        # Get user data from Emergent Auth
        async with httpx.AsyncClient() as client_http:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            user_data = auth_response.json()
        
        # Check if user exists, create if not
        existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            # Update user info
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "name": user_data["name"],
                    "picture": user_data.get("picture")
                }}
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                "user_id": user_id,
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(new_user)
        
        # Create session
        session_token = user_data.get("session_token", f"session_{uuid.uuid4().hex}")
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Set httpOnly cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60
        )
        
        # Get user data to return
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        
        return {"user": user_doc, "session_token": session_token}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me")
async def get_current_user(request: Request):
    """Get current authenticated user"""
    # Check cookie first, then Authorization header
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_doc

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"message": "Logged out successfully"}

# ==================== HELPER FUNCTION ====================

async def get_user_from_request(request: Request) -> dict:
    """Extract and validate user from request"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_doc

# ==================== SUPPLIER ENDPOINTS ====================

@api_router.get("/suppliers")
async def get_suppliers(request: Request):
    """Get all supplier benchmarks sorted by upstream impact"""
    await get_user_from_request(request)
    
    suppliers = await db.supplier_benchmarks.find(
        {},
        {"_id": 0}
    ).sort("upstream_impact_pct", -1).to_list(500)
    
    return {"suppliers": suppliers, "total": len(suppliers)}

@api_router.get("/suppliers/{supplier_id}/deep-dive")
async def get_supplier_deep_dive(supplier_id: str, request: Request):
    """Get detailed AI recommendation for a supplier"""
    await get_user_from_request(request)
    
    # Get benchmark data
    benchmark = await db.supplier_benchmarks.find_one(
        {"id": supplier_id},
        {"_id": 0}
    )
    
    if not benchmark:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Get recommendation content
    recommendation = await db.recommendation_content.find_one(
        {"benchmark_id": supplier_id},
        {"_id": 0}
    )
    
    if not recommendation:
        # Generate AI recommendation if not cached
        recommendation = await generate_ai_recommendation(benchmark)
    
    return {
        "meta": {
            "supplier_name": benchmark["supplier_name"],
            "peer_name": benchmark["peer_name"],
            "comparison_year": "2024",
            "industry_sector": benchmark["industry_sector"],
            "category": benchmark["category"]
        },
        "metrics": {
            "current_intensity": benchmark["supplier_intensity"],
            "target_intensity": benchmark["peer_intensity"],
            "reduction_potential_percentage": benchmark["potential_reduction_pct"],
            "upstream_impact_percentage": benchmark["upstream_impact_pct"],
            "cee_rating": benchmark["cee_rating"]
        },
        "content": {
            "headline": recommendation["headline"],
            "action_plan": recommendation["action_plan"],
            "case_study_summary": recommendation["case_study_summary"],
            "contract_clause": recommendation["contract_clause"],
            "feasibility_timeline": recommendation["feasibility_timeline"],
            "source_docs": recommendation["source_citations"]
        }
    }

async def generate_ai_recommendation(benchmark: dict) -> dict:
    """Generate AI recommendation using Gemini 3 Flash"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"recommendation_{benchmark['id']}",
            system_message="""You are an expert Supply Chain Sustainability Analyst and Legal Contract Strategist. 
Your goal is to analyze sustainability reports from a high-performing company (the "Peer") and generate a tactical reduction plan for a lower-performing company (the "Supplier").

STRICT GUIDELINES:
1. Zero Hallucination: Reference source pages for every claim.
2. Technical Specificity: Use engineering keywords like "Bio-based," "Electric Arc Furnace," "Recycled Content," "Renewable Energy PPAs."
3. Legal Tone: Write contract clauses in formal legal language for MSA renewals.

Output ONLY valid JSON with this structure:
{
  "headline": "1-sentence summary of achievement",
  "action_plan": [{"step": 1, "title": "...", "detail": "...", "citation": "..."}],
  "case_study_summary": "3-sentence paragraph",
  "contract_clause": "Formal legal clause",
  "feasibility_timeline": "Estimated implementation time"
}"""
        ).with_model("gemini", "gemini-3-flash-preview")
        
        prompt = f"""Generate a reduction recommendation for:

SUPPLIER: {benchmark['supplier_name']} (Current Intensity: {benchmark['supplier_intensity']} kgCO2e/unit)
PEER (Leader): {benchmark['peer_name']} (Intensity: {benchmark['peer_intensity']} kgCO2e/unit)
CATEGORY: {benchmark['category']}
INDUSTRY: {benchmark['industry_sector']}
REDUCTION POTENTIAL: {benchmark['potential_reduction_pct']}%

The peer achieved a {benchmark['potential_reduction_pct']}% reduction. Generate specific technical actions they likely took based on industry best practices."""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        import json
        # Clean the response to extract JSON
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        ai_content = json.loads(response_text.strip())
        
        # Create recommendation document
        recommendation = {
            "benchmark_id": benchmark["id"],
            "headline": ai_content.get("headline", f"{benchmark['peer_name']} achieved significant emissions reduction through sustainable practices."),
            "action_plan": ai_content.get("action_plan", []),
            "case_study_summary": ai_content.get("case_study_summary", ""),
            "contract_clause": ai_content.get("contract_clause", ""),
            "feasibility_timeline": ai_content.get("feasibility_timeline", "24-36 months"),
            "source_citations": [
                {"title": f"{benchmark['peer_name']} Sustainability Report 2024", "url": f"https://example.com/{benchmark['peer_name'].lower().replace(' ', '-')}/sustainability-2024.pdf"}
            ],
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Cache the recommendation
        await db.recommendation_content.insert_one({**recommendation, "_id": None})
        del recommendation.get("_id", None) if "_id" in recommendation else None
        
        return recommendation
        
    except Exception as e:
        logger.error(f"AI generation error: {e}")
        # Return fallback content
        return {
            "benchmark_id": benchmark["id"],
            "headline": f"{benchmark['peer_name']} achieved a {benchmark['potential_reduction_pct']}% reduction through sustainable material substitution.",
            "action_plan": [
                {"step": 1, "title": "Material Audit", "detail": "Conduct comprehensive audit of current material inputs to identify high-carbon alternatives.", "citation": "Industry Best Practice"},
                {"step": 2, "title": "Supplier Engagement", "detail": "Engage with tier-2 suppliers to establish carbon reduction roadmaps.", "citation": "GHG Protocol Scope 3 Guidance"},
                {"step": 3, "title": "Process Optimization", "detail": "Implement energy efficiency measures and renewable energy procurement.", "citation": "Science Based Targets Initiative"}
            ],
            "case_study_summary": f"{benchmark['peer_name']} demonstrated industry leadership by achieving significant carbon intensity reductions through a combination of material substitution, process optimization, and renewable energy adoption. Their approach focused on high-impact areas within their value chain.",
            "contract_clause": f"Supplier agrees to reduce carbon intensity of delivered goods by minimum {min(5, int(benchmark['potential_reduction_pct']/4))}% year-over-year, with target alignment to {benchmark['peer_name']}'s achieved intensity of {benchmark['peer_intensity']} kgCO2e/unit within 36 months.",
            "feasibility_timeline": "24-36 months",
            "source_citations": [
                {"title": f"{benchmark['peer_name']} Sustainability Report 2024", "url": f"https://example.com/reports/{benchmark['peer_name'].lower().replace(' ', '-')}.pdf"}
            ],
            "generated_at": datetime.now(timezone.utc).isoformat()
        }

# ==================== HEATMAP ENDPOINT ====================

@api_router.get("/suppliers/heatmap")
async def get_heatmap_data(request: Request):
    """Get heatmap data for carbon intensity visualization"""
    await get_user_from_request(request)
    
    suppliers = await db.supplier_benchmarks.find(
        {},
        {"_id": 0, "id": 1, "supplier_name": 1, "category": 1, "supplier_intensity": 1, "potential_reduction_pct": 1, "cee_rating": 1}
    ).to_list(500)
    
    return {"heatmap_data": suppliers}

# ==================== SEED DATA ====================

@api_router.post("/seed-data")
async def seed_mock_data():
    """Seed the database with mock supplier data"""
    # Clear existing data
    await db.supplier_benchmarks.delete_many({})
    await db.recommendation_content.delete_many({})
    
    mock_suppliers = [
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "ppg_001",
            "supplier_name": "PPG Industries",
            "peer_id": "sika_001",
            "peer_name": "Sika AG",
            "category": "Purchased Goods & Services",
            "cee_rating": "C-",
            "supplier_intensity": 0.45,
            "peer_intensity": 0.35,
            "potential_reduction_pct": 22.0,
            "upstream_impact_pct": 8.78,
            "industry_sector": "Chemicals & Coatings",
            "revenue_band": "$10B-$20B"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "ups_001",
            "supplier_name": "UPS Logistics",
            "peer_id": "dhl_001",
            "peer_name": "DHL Express",
            "category": "Transport & Distribution",
            "cee_rating": "B",
            "supplier_intensity": 0.32,
            "peer_intensity": 0.27,
            "potential_reduction_pct": 15.6,
            "upstream_impact_pct": 4.12,
            "industry_sector": "Logistics",
            "revenue_band": "$50B+"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "dow_001",
            "supplier_name": "Dow Chemical",
            "peer_id": "basf_001",
            "peer_name": "BASF SE",
            "category": "Fuel & Energy Activities",
            "cee_rating": "C",
            "supplier_intensity": 0.58,
            "peer_intensity": 0.47,
            "potential_reduction_pct": 18.9,
            "upstream_impact_pct": 3.05,
            "industry_sector": "Petrochemicals",
            "revenue_band": "$50B+"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "cat_001",
            "supplier_name": "Caterpillar Inc",
            "peer_id": "komatsu_001",
            "peer_name": "Komatsu Ltd",
            "category": "Capital Goods",
            "cee_rating": "C+",
            "supplier_intensity": 0.42,
            "peer_intensity": 0.33,
            "potential_reduction_pct": 21.4,
            "upstream_impact_pct": 2.89,
            "industry_sector": "Heavy Machinery",
            "revenue_band": "$50B+"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "ford_001",
            "supplier_name": "Ford Motor Co",
            "peer_id": "tesla_001",
            "peer_name": "Tesla Inc",
            "category": "Purchased Goods & Services",
            "cee_rating": "D+",
            "supplier_intensity": 0.68,
            "peer_intensity": 0.41,
            "potential_reduction_pct": 39.7,
            "upstream_impact_pct": 2.45,
            "industry_sector": "Automotive",
            "revenue_band": "$100B+"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "alcoa_001",
            "supplier_name": "Alcoa Corporation",
            "peer_id": "novelis_001",
            "peer_name": "Novelis Inc",
            "category": "Purchased Goods & Services",
            "cee_rating": "C-",
            "supplier_intensity": 0.72,
            "peer_intensity": 0.52,
            "potential_reduction_pct": 27.8,
            "upstream_impact_pct": 2.31,
            "industry_sector": "Aluminum Production",
            "revenue_band": "$10B-$20B"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "maersk_001",
            "supplier_name": "Maersk Line",
            "peer_id": "cma_001",
            "peer_name": "CMA CGM",
            "category": "Transport & Distribution",
            "cee_rating": "B-",
            "supplier_intensity": 0.38,
            "peer_intensity": 0.31,
            "potential_reduction_pct": 18.4,
            "upstream_impact_pct": 1.98,
            "industry_sector": "Maritime Shipping",
            "revenue_band": "$50B+"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "nucor_001",
            "supplier_name": "Nucor Steel",
            "peer_id": "ssab_001",
            "peer_name": "SSAB AB",
            "category": "Purchased Goods & Services",
            "cee_rating": "B+",
            "supplier_intensity": 0.28,
            "peer_intensity": 0.19,
            "potential_reduction_pct": 32.1,
            "upstream_impact_pct": 1.76,
            "industry_sector": "Steel Production",
            "revenue_band": "$20B-$50B"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "dupont_001",
            "supplier_name": "DuPont de Nemours",
            "peer_id": "dsm_001",
            "peer_name": "DSM-Firmenich",
            "category": "Fuel & Energy Activities",
            "cee_rating": "B",
            "supplier_intensity": 0.35,
            "peer_intensity": 0.28,
            "potential_reduction_pct": 20.0,
            "upstream_impact_pct": 1.54,
            "industry_sector": "Specialty Chemicals",
            "revenue_band": "$10B-$20B"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "fedex_001",
            "supplier_name": "FedEx Corporation",
            "peer_id": "ups_green_001",
            "peer_name": "UPS Green Fleet",
            "category": "Transport & Distribution",
            "cee_rating": "B-",
            "supplier_intensity": 0.41,
            "peer_intensity": 0.32,
            "potential_reduction_pct": 22.0,
            "upstream_impact_pct": 1.42,
            "industry_sector": "Logistics",
            "revenue_band": "$50B+"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "packaging_001",
            "supplier_name": "International Paper",
            "peer_id": "stora_001",
            "peer_name": "Stora Enso",
            "category": "Packaging Materials",
            "cee_rating": "C+",
            "supplier_intensity": 0.48,
            "peer_intensity": 0.36,
            "potential_reduction_pct": 25.0,
            "upstream_impact_pct": 1.28,
            "industry_sector": "Paper & Packaging",
            "revenue_band": "$20B-$50B"
        },
        {
            "id": str(uuid.uuid4()),
            "supplier_id": "cement_001",
            "supplier_name": "LafargeHolcim",
            "peer_id": "heidelberg_001",
            "peer_name": "Heidelberg Materials",
            "category": "Purchased Goods & Services",
            "cee_rating": "D",
            "supplier_intensity": 0.82,
            "peer_intensity": 0.65,
            "potential_reduction_pct": 20.7,
            "upstream_impact_pct": 1.15,
            "industry_sector": "Cement & Aggregates",
            "revenue_band": "$20B-$50B"
        }
    ]
    
    await db.supplier_benchmarks.insert_many(mock_suppliers)
    
    return {"message": "Mock data seeded successfully", "count": len(mock_suppliers)}

# ==================== BASIC ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Scope 3 Reduce API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
