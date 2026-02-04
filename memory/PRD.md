# AI-Powered Recommendations Engine - PRD

## Original Problem Statement
Build an AI-Powered Recommendations Engine for Scope 3 "Reduce" Module - a platform that converts carbon data into actionable, peer-validated supplier negotiation strategies.

## Target Audience
- Procurement Officers
- Supply Chain Managers  
- CSO (Chief Sustainability Officers)

## Core Requirements (Static)
1. **Top Reduction Actions Dashboard** - Data table showing suppliers with CEE ratings, reduction potential, upstream impact
2. **AI Recommendation Engine** - Peer matching, gap analysis, evidence retrieval using Gemini 3 Flash
3. **Deep Dive Action Cards** - Slide-out modals with narratives, action plans, feasibility timelines, case studies, contract clauses
4. **Carbon Intensity Heatmap** - Visual representation of supplier emissions
5. **User Authentication** - Emergent-managed Google OAuth

## What's Been Implemented (Date: 2026-02-04)

### Backend (FastAPI)
- ✅ MongoDB integration with supplier_benchmarks and recommendation_content collections
- ✅ Emergent Google OAuth authentication flow
- ✅ Session-based auth with httpOnly cookies
- ✅ GET /api/suppliers - Supplier list sorted by upstream impact
- ✅ GET /api/suppliers/{id}/deep-dive - AI-powered recommendation generation
- ✅ POST /api/seed-data - Mock data seeding (12 suppliers)
- ✅ Gemini 3 Flash integration for AI recommendations

### Frontend (React)
- ✅ Landing page with "Mission Control for Earth" aesthetic
- ✅ Google OAuth login integration
- ✅ Dashboard with sidebar navigation (Measure, Reduce, Engage modules)
- ✅ Supplier data table with sortable columns
- ✅ CEE rating badges (A-D with color coding)
- ✅ Deep Dive slide-out panel with AI recommendations
- ✅ Action plan display with numbered steps
- ✅ Contract clause with copy-to-clipboard
- ✅ Heatmap view toggle
- ✅ Dark theme with Barlow Condensed + Manrope fonts

### Design System
- Dark background (#0A0A0A) with green accents (#22C55E)
- Glassmorphism effects for modals
- Data-dense "trading floor" aesthetic
- Responsive layout

## Architecture
```
Frontend (React + Tailwind + Shadcn) → Backend (FastAPI) → MongoDB
                                           ↓
                               Gemini 3 Flash (AI Recommendations)
                                           ↓
                               Emergent Auth (Google OAuth)
```

## Tech Stack
- Frontend: React 19, Tailwind CSS, Shadcn UI, Recharts
- Backend: FastAPI, Motor (async MongoDB), Pydantic
- Database: MongoDB
- AI: Gemini 3 Flash via emergentintegrations
- Auth: Emergent-managed Google OAuth

## P0/P1/P2 Features

### P0 (Implemented)
- [x] Dashboard with supplier rankings
- [x] AI recommendation generation
- [x] Contract clause generation
- [x] Copy-to-clipboard functionality
- [x] Google OAuth authentication
- [x] **NEW: PDF Export** - Download recommendations as formatted PDF
- [x] **NEW: Engagement Tracking** - Track supplier engagement status (not_started, in_progress, pending_response, completed, on_hold)
- [x] **NEW: Data Filtering** - Filter by category, CEE rating, min upstream impact, min reduction potential

### P1 (Backlog)
- [ ] Export recommendations to PDF
- [ ] Supplier engagement tracking
- [ ] Email notifications for high-impact opportunities
- [ ] Multi-project support
- [ ] Team collaboration features

### P2 (Future)
- [ ] Real-time CDP/GRI data ingestion
- [ ] Custom peer selection
- [ ] Benchmarking against industry averages
- [ ] Integration with procurement systems
- [ ] Carbon reduction progress tracking

## Next Tasks
1. ~~Add PDF export for recommendations~~ ✅ DONE
2. ~~Implement supplier engagement status tracking~~ ✅ DONE  
3. ~~Add data filtering (by category, rating, impact threshold)~~ ✅ DONE
4. Add notification system for high-priority actions
5. Create settings page for user preferences
6. Export engagement history to CSV
7. Add bulk actions for multiple suppliers
