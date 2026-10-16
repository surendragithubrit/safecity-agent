const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    const message = typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((error) => error.msg).join("; ")
        : body?.message || "Request failed";
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  health: () => request("/health"),
  searchPlaces: (query, lat, lon) => {
    const params = new URLSearchParams({ q: query, lat: String(lat), lon: String(lon) });
    return request(`/api/places/search?${params.toString()}`);
  },
  currentWeather: (lat, lon) => {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    return request(`/api/weather/current?${params.toString()}`);
  },
  walkingRoutes: (payload) => request("/api/routes/walking", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  alertAutomationStatus: (recipientEmail) => {
    const params = new URLSearchParams({ recipient_email: recipientEmail });
    return request(`/api/alerts/automation?${params.toString()}`);
  },
  analyzeRisk: (payload) => request("/api/risk/analyze", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  analyzeEmergency: (payload) => request("/api/emergency/analyze", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  prepareAlert: (payload) => request("/api/alerts/prepare", {
    method: "POST",
    body: JSON.stringify(payload)
  })
};
