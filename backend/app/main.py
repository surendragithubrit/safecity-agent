from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import (
    RiskRequest, WalkingRouteRequest, EmergencyRequest,
    AlertPrepareRequest
)
from app.agents.risk_agent import analyze_risk
from app.agents.emergency_agent import analyze_emergency
from app.agents.alert_agent import prepare_alert
from app.services.database import init_db, list_alerts
from app.services.email_service import email_is_configured, is_allowed_recipient
from app.services.map_service import current_weather, search_places, walking_routes

app = FastAPI(
    title="SafeCity Agent API",
    version="1.0.0",
    description="Educational AI-assisted women's safety prototype."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/health")
def health():
    return {"status": "ok", "service": "safecity-agent-api"}

@app.get("/api/places/search")
async def places_search(
    q: str = Query(min_length=2, max_length=120),
    lat: float = Query(default=17.385, ge=-90, le=90),
    lon: float = Query(default=78.4867, ge=-180, le=180),
):
    return await search_places(q, lat, lon)

@app.get("/api/weather/current")
async def weather_current(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
):
    return await current_weather(lat, lon)

@app.post("/api/routes/walking")
async def route_walking(request: WalkingRouteRequest):
    return {
        "routes": await walking_routes(
            request.origin.model_dump(),
            request.destination.model_dump(),
        )
    }

@app.post("/api/risk/analyze")
async def risk_analyze(request: RiskRequest):
    return await analyze_risk(request.model_dump())

@app.post("/api/emergency/analyze")
async def emergency_analyze(request: EmergencyRequest):
    return await analyze_emergency(request.message, request.location)

@app.get("/api/alerts/automation")
def alert_automation_status(recipient_email: str = Query(default="", max_length=254)):
    return {
        "email_configured": email_is_configured(),
        "recipient_allowed": is_allowed_recipient(recipient_email),
    }

@app.post("/api/alerts/prepare")
async def alert_prepare(request: AlertPrepareRequest):
    return await prepare_alert(request.model_dump())

@app.get("/api/alerts")
def alerts():
    return list_alerts()
