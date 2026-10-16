from app.services.llm_service import ask_for_json

def calculate_risk(data: dict):
    score = 0
    reasons = []

    hour = int(data["time"].split(":")[0])
    if hour >= 22 or hour < 5:
        score += 25
        reasons.append("The selected time falls in a late-night period.")
    elif hour >= 19:
        score += 15
        reasons.append("The selected time is during the evening.")

    lighting_points = {"poor": 25, "average": 10, "good": 0, "unknown": 0}
    score += lighting_points[data["lighting"]]
    if data["lighting"] == "poor":
        reasons.append("Poor lighting increases the rule-based risk score.")
    elif data["lighting"] == "average":
        reasons.append("Average lighting contributes a small risk factor.")
    elif data["lighting"] == "unknown":
        reasons.append("Lighting information was not provided.")

    crowd_points = {"low": 20, "medium": 8, "high": 0, "unknown": 0}
    score += crowd_points[data["crowd_density"]]
    if data["crowd_density"] == "low":
        reasons.append("Low crowd density contributes to the risk score.")
    elif data["crowd_density"] == "unknown":
        reasons.append("Crowd density information was not provided.")

    if data["incident_count"] is not None:
        incident_points = min(data["incident_count"] * 4, 24)
        score += incident_points
        reasons.append(
            "The user-provided incident count contributes to the score; no live incident feed is connected."
        )
    else:
        reasons.append("No incident count was supplied; no live incident feed is connected.")

    if data["weather"] == "rain":
        score += 5
        reasons.append("Rain may reduce visibility and mobility.")
    elif data["weather"] == "storm":
        score += 12
        reasons.append("Storm conditions may reduce visibility and mobility.")

    score = min(score, 100)
    if score >= 60:
        level = "High Risk"
    elif score >= 30:
        level = "Medium Risk"
    else:
        level = "Low Risk"

    return {
        "risk_score": score,
        "risk_level": level,
        "reasons": reasons,
        "recommendation": (
            "Consider delaying travel, choosing a populated route, and informing a trusted contact."
            if level == "High Risk"
            else "Stay aware of your surroundings and prefer well-lit, populated paths."
            if level == "Medium Risk"
            else "The supplied factors produce a lower demonstration score. This does not establish that the area is safe."
        )
    }

async def analyze_risk(data: dict):
    base = calculate_risk(data)

    prompt_data = {**data, **base}
    llm_result = await ask_for_json(
        system_prompt=(
            "You are a safety-assistance explanation agent. "
            "Use only the supplied fields. Do not claim to predict crime or describe a low score as proof that a place is safe. "
            "Return JSON with keys explanation and limitations."
        ),
        user_prompt=f"Explain this rule-based result clearly for a user:\n{prompt_data}"
    )

    explanation = llm_result.get("explanation") if isinstance(llm_result, dict) else None
    limitations = llm_result.get("limitations") if isinstance(llm_result, dict) else None
    if (
        isinstance(explanation, str)
        and isinstance(limitations, list)
        and all(isinstance(limitation, str) for limitation in limitations)
    ):
        base["ai_explanation"] = explanation
        base["limitations"] = limitations
        base["llm_used"] = True
    else:
        base["ai_explanation"] = (
            "This is a transparent demonstration score based on the selected time, user-provided lighting and crowd estimates, current weather when available, and any incident count entered."
        )
        base["limitations"] = [
            "This is not a crime prediction.",
            "No live crime or incident data is connected; the score must not be treated as a guarantee of safety.",
            "Lighting and crowd estimates are user-provided and may be incomplete."
        ]
        base["llm_used"] = False

    return base
