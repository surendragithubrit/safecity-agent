from app.services.llm_service import ask_for_json

HIGH_RISK_TERMS = [
    "help", "danger", "attack", "following me", "threat", "kidnap",
    "hurt me", "emergency", "unsafe", "save me", "harass"
]

def fallback_analysis(message: str):
    text = message.lower()
    matches = [term for term in HIGH_RISK_TERMS if term in text]

    if any(term in text for term in ["attack", "kidnap", "hurt me", "emergency", "save me"]):
        urgency = "Critical"
    elif matches:
        urgency = "High"
    else:
        urgency = "Low"

    return {
        "distress_detected": bool(matches),
        "urgency": urgency,
        "matched_terms": matches,
        "recommended_action": (
            "If you are in immediate danger, contact local emergency services now. "
            "Move toward a populated, well-lit place and contact a trusted person."
            if matches else
            "No obvious distress keyword was detected. If you feel unsafe, seek help from a trusted person."
        )
    }

async def analyze_emergency(message: str, location: str | None):
    result = fallback_analysis(message)

    llm_result = await ask_for_json(
        system_prompt=(
            "You are an emergency message triage assistant. "
            "Classify possible distress conservatively. Do not diagnose, investigate, "
            "or claim certainty. Return JSON with distress_detected, urgency, "
            "recommended_action, and limitations."
        ),
        user_prompt=f"Message: {message}\nLocation: {location or 'not provided'}"
    )

    if llm_result:
        llm_urgency = str(llm_result.get("urgency", "")).strip().title()
        urgency = llm_urgency if llm_urgency in {"Low", "Medium", "High", "Critical"} else result["urgency"]
        result.update({
            "distress_detected": (
                result["distress_detected"]
                or bool(llm_result.get("distress_detected", False))
            ),
            "urgency": urgency,
            "recommended_action": llm_result.get("recommended_action", result["recommended_action"]),
            "limitations": llm_result.get("limitations", [])
        })
        result["llm_used"] = True
    else:
        result["limitations"] = [
            "Keyword and prompt-based triage can produce false positives or false negatives.",
            "This feature does not replace emergency services."
        ]
        result["llm_used"] = False

    result["location"] = location
    return result
