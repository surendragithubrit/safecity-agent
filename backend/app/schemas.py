from typing import Literal, Optional
from pydantic import BaseModel, Field

RiskLevel = Literal["Low Risk", "Medium Risk", "High Risk"]
Urgency = Literal["Low", "Medium", "High", "Critical"]

class RiskRequest(BaseModel):
    location: str = "College Road"
    time: str = "21:30"
    crowd_density: Literal["low", "medium", "high", "unknown"] = "unknown"
    lighting: Literal["poor", "average", "good", "unknown"] = "unknown"
    incident_count: Optional[int] = Field(default=None, ge=0, le=100)
    weather: Literal["clear", "rain", "storm", "unknown"] = "clear"


class Coordinate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class WalkingRouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate


class EmergencyRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    location: Optional[str] = None

class AlertPrepareRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    urgency: Urgency
    location: Optional[str] = None
    recipient_email: str = Field(
        min_length=3,
        max_length=254,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )
    confirmed_by_user: bool = False
    trigger_source: Literal[
        "user_confirmed",
        "voice_distress",
        "typed_distress",
        "journey_missed_checkin",
        "journey_overdue",
    ] = "user_confirmed"
