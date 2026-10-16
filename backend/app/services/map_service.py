import json
import math

import httpx
from fastapi import HTTPException

PHOTON_URL = "https://photon.komoot.io/api/"
VALHALLA_URL = "https://valhalla1.openstreetmap.de/route"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
HTTP_TIMEOUT = 12.0
USER_AGENT = "SafeCityAgent/1.0 (educational safety prototype)"


def _place_label(properties: dict) -> str:
    parts = [
        properties.get("name") or properties.get("street"),
        properties.get("district") or properties.get("locality"),
        properties.get("city"),
    ]
    label_parts = []
    for part in parts:
        if part and part.casefold() not in {item.casefold() for item in label_parts}:
            label_parts.append(part)
    return ", ".join(label_parts) or properties.get("country", "Unknown place")


async def search_places(query: str, lat: float, lon: float) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            response = await client.get(
                PHOTON_URL,
                params={"q": query, "limit": 6, "lat": lat, "lon": lon},
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail="The OpenStreetMap place search is temporarily unavailable.",
        ) from exc
    except (httpx.RequestError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the OpenStreetMap place search. Please try again.",
        ) from exc

    features = payload.get("features") if isinstance(payload, dict) else None
    if not isinstance(features, list):
        raise HTTPException(status_code=502, detail="The OpenStreetMap place search returned invalid data.")

    places = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry")
        properties = feature.get("properties")
        if not isinstance(geometry, dict) or not isinstance(properties, dict):
            continue
        coordinates = geometry.get("coordinates", [])
        if (
            not isinstance(coordinates, list)
            or len(coordinates) != 2
            or not all(isinstance(value, (int, float)) for value in coordinates)
        ):
            continue
        places.append({
            "id": f'{properties.get("osm_type", "place")}-{properties.get("osm_id", len(places))}',
            "label": _place_label(properties),
            "lat": coordinates[1],
            "lon": coordinates[0],
        })
    return places


async def current_weather(lat: float, lon: float) -> dict:
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            response = await client.get(
                OPEN_METEO_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,precipitation,weather_code,wind_speed_10m",
                    "timezone": "auto",
                },
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail="The live weather service is temporarily unavailable.",
        ) from exc
    except (httpx.RequestError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the live weather service. Please try again.",
        ) from exc

    current = payload.get("current")
    if not isinstance(current, dict):
        raise HTTPException(status_code=502, detail="The live weather service returned no current conditions.")

    weather_code = current.get("weather_code")
    precipitation = current.get("precipitation", 0)
    if not isinstance(weather_code, int) or not isinstance(precipitation, (int, float)):
        raise HTTPException(status_code=502, detail="The live weather service returned invalid current conditions.")

    if weather_code >= 95:
        weather = "storm"
    elif precipitation > 0 or 51 <= weather_code <= 67 or 80 <= weather_code <= 82:
        weather = "rain"
    elif weather_code in {0, 1}:
        weather = "clear"
    else:
        weather = "unknown"

    return {
        "weather": weather,
        "observed_at": current.get("time"),
        "temperature_c": current.get("temperature_2m"),
        "wind_speed_kmh": current.get("wind_speed_10m"),
    }


def _decode_polyline6(encoded: str) -> list[list[float]]:
    coordinates = []
    latitude = 0
    longitude = 0
    index = 0

    while index < len(encoded):
        values = []
        for _ in range(2):
            result = 0
            shift = 0
            while True:
                if index >= len(encoded):
                    raise ValueError("Incomplete encoded route geometry.")
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            values.append(~(result >> 1) if result & 1 else result >> 1)
        latitude += values[0]
        longitude += values[1]
        coordinates.append([latitude / 1_000_000, longitude / 1_000_000])
    return coordinates


def _format_route(trip: dict) -> dict:
    summary = trip.get("summary", {})
    legs = trip.get("legs", [])
    if not isinstance(summary, dict) or not isinstance(legs, list) or not legs:
        raise ValueError("Route summary or directions are missing.")
    if any(not isinstance(leg, dict) for leg in legs):
        raise ValueError("Route directions are invalid.")
    shape = legs[0].get("shape") if legs else None
    if not isinstance(shape, str) or not shape:
        raise ValueError("Route geometry is missing.")

    maneuvers = []
    street_names = []
    for leg in legs:
        instructions = leg.get("maneuvers", [])
        if not isinstance(instructions, list):
            raise ValueError("Route instructions are invalid.")
        for maneuver in instructions:
            if not isinstance(maneuver, dict):
                continue
            if maneuver.get("instruction"):
                maneuvers.append(maneuver["instruction"])
            names = maneuver.get("street_names", [])
            if isinstance(names, list):
                street_names.extend(name for name in names if isinstance(name, str) and name)
    main_streets = list(dict.fromkeys(street_names))[:2]
    name = f"Via {' and '.join(main_streets)}" if main_streets else "Pedestrian route"
    distance_km = summary.get("length")
    duration_seconds = summary.get("time")
    if (
        not isinstance(distance_km, (int, float))
        or not isinstance(duration_seconds, (int, float))
        or distance_km < 0
        or duration_seconds < 0
    ):
        raise ValueError("Route summary is missing.")

    return {
        "name": name,
        "distance_km": round(distance_km, 2),
        "duration_minutes": max(1, math.ceil(duration_seconds / 60)),
        "geometry": _decode_polyline6(shape),
        "instructions": maneuvers,
    }


async def walking_routes(origin: dict, destination: dict) -> list[dict]:
    request = {
        "locations": [
            {"lat": origin["lat"], "lon": origin["lon"]},
            {"lat": destination["lat"], "lon": destination["lon"]},
        ],
        "costing": "pedestrian",
        "directions_options": {"units": "kilometers"},
        "alternates": 2,
        "shape_format": "geojson",
    }

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            response = await client.get(
                VALHALLA_URL,
                params={"json": json.dumps(request, separators=(",", ":"))},
                headers={"User-Agent": USER_AGENT},
            )
            payload = response.json()
            if response.status_code >= 500:
                raise HTTPException(
                    status_code=502,
                    detail="The OpenStreetMap walking route service is temporarily unavailable.",
                )
            if response.is_error:
                detail = (
                    payload.get("error")
                    if isinstance(payload, dict)
                    else None
                ) or "The walking route service could not calculate this trip."
                raise HTTPException(status_code=422, detail=detail)
    except HTTPException:
        raise
    except (httpx.RequestError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the OpenStreetMap walking route service. Please try again.",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="The walking route service returned invalid data.")

    trips = []
    primary = payload.get("trip")
    if isinstance(primary, dict):
        trips.append(primary)
    alternates = payload.get("alternates")
    if not isinstance(alternates, list):
        alternates = []
    for alternate in alternates:
        trip = alternate.get("trip") if isinstance(alternate, dict) else None
        if isinstance(trip, dict):
            trips.append(trip)
    if not trips:
        detail = payload.get("error") or "No walking routes were found between these places."
        raise HTTPException(status_code=422, detail=detail)

    try:
        routes = [_format_route(trip) for trip in trips]
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="The walking route service returned an invalid route. Please try again.",
        ) from exc

    routes.sort(key=lambda route: route["distance_km"])
    for index, route in enumerate(routes, start=1):
        route["route_id"] = f"walking-route-{index}"
    return routes
