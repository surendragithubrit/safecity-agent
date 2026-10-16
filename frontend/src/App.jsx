import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import SectionCard from "./components/SectionCard";
import ResultBox from "./components/ResultBox";
import LocationMap from "./components/LocationMap";
import PlaceAutocomplete from "./components/PlaceAutocomplete";

const initialRisk = {
  location: "",
  time: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(11, 16),
  crowd_density: "unknown",
  lighting: "unknown",
  incident_count: "",
  weather: "unknown"
};

const DEFAULT_PLACE_CENTER = { lat: 17.385, lon: 78.4867 };

const agents = [
  { id: "risk-agent", path: "/risk-prediction", number: "01", title: "Risk Prediction", description: "Review estimated area risk", icon: "shield" },
  { id: "route-agent", path: "/safe-routes", number: "02", title: "Safe Routes", description: "Find a walking route", icon: "route" },
  { id: "emergency-agent", path: "/emergency-sos", number: "03", title: "Emergency SOS", description: "Get help for an SOS", icon: "alert" },
  { id: "journey-agent", path: "/journey-tracker", number: "04", title: "Journey Tracker", description: "Plan check-ins on a trip", icon: "journey" }
];

function getAgentForPath(pathname) {
  return agents.find((agent) => agent.path === pathname) || null;
}

function isLoginPath(pathname) {
  return pathname === "/" || pathname === "/login";
}

function AgentIcon({ name }) {
  const images = {
    shield: "risk-prediction",
    route: "safe-routes",
    alert: "emergency-sos",
    journey: "journey-tracker"
  };

  return <img src={`/agent-icons/${images[name]}.png`} alt="" aria-hidden="true" />;
}

function createGmailComposeUrl(payload) {
  const subject = `SafeCity safety alert - ${payload.urgency} urgency`;
  const body = [
    "A safety alert was prepared from SafeCity Agent.",
    "",
    `Urgency: ${payload.urgency}`,
    `Location: ${payload.location || "Not shared"}`,
    `Message: ${payload.message}`,
    "",
    "If immediate help is needed, contact local emergency services."
  ].join("\n");

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: payload.recipient_email,
    su: subject,
    body
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function App() {
  const [showLogin, setShowLogin] = useState(() => isLoginPath(window.location.pathname));
  const [activeAgent, setActiveAgent] = useState(() => getAgentForPath(window.location.pathname)?.id || null);
  const [riskForm, setRiskForm] = useState(initialRisk);
  const [riskResult, setRiskResult] = useState(null);
  const [riskError, setRiskError] = useState("");
  const [routeResult, setRouteResult] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [riskPlace, setRiskPlace] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState("");
  const [currentWeather, setCurrentWeather] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeOriginText, setRouteOriginText] = useState("");
  const [routeDestination, setRouteDestination] = useState(null);
  const [routeDestinationText, setRouteDestinationText] = useState("");
  const [emergencyMessage, setEmergencyMessage] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("durgasripeetha@gmail.com");
  const [emergencyLocation, setEmergencyLocation] = useState("");
  const [userPosition, setUserPosition] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Location is off. Share your location to show it on the map.");
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState(null);
  const [alertResult, setAlertResult] = useState(null);
  const [emailSendConfirmed, setEmailSendConfirmed] = useState(false);
  const [emailAutomationConfigured, setEmailAutomationConfigured] = useState(null);
  const [emailRecipientAllowed, setEmailRecipientAllowed] = useState(false);
  const [journeyDestination, setJourneyDestination] = useState("");
  const [journeyArrivalInput, setJourneyArrivalInput] = useState("");
  const [journeyCheckInMinutes, setJourneyCheckInMinutes] = useState(1);
  const [journey, setJourney] = useState(null);
  const [journeyNow, setJourneyNow] = useState(Date.now());
  const [journeyError, setJourneyError] = useState("");
  const [journeyAlertResult, setJourneyAlertResult] = useState(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const recognitionRef = useRef(null);
  const voiceHandledRef = useRef(false);
  const locationWatchRef = useRef(null);
  const emergencyLocationRef = useRef("");
  const journeyAlertSentRef = useRef(null);
  const riskOutputRef = useRef(null);

  useEffect(() => {
    function syncPageWithUrl() {
      let pathname = window.location.pathname;
      const agent = getAgentForPath(pathname);
      if (!agent && !isLoginPath(pathname) && pathname !== "/home") {
        window.history.replaceState(null, "", "/login");
        pathname = "/login";
      }
      setShowLogin(isLoginPath(pathname));
      setActiveAgent(agent?.id || null);
    }

    window.addEventListener("popstate", syncPageWithUrl);
    return () => window.removeEventListener("popstate", syncPageWithUrl);
  }, []);

  useEffect(() => {
    if (riskResult || riskError) {
      riskOutputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [riskResult, riskError]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      api.alertAutomationStatus(recipientEmail)
        .then((status) => {
          if (active) {
            setEmailAutomationConfigured(status.email_configured);
            setEmailRecipientAllowed(status.recipient_allowed);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
          }
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [recipientEmail]);

  useEffect(() => {
    if (!riskPlace) {
      setCurrentWeather(null);
      setWeatherStatus("");
      return undefined;
    }

    let active = true;
    setCurrentWeather(null);
    setWeatherStatus("Loading current weather…");
    api.currentWeather(riskPlace.lat, riskPlace.lon)
      .then((weather) => {
        if (active) {
          setCurrentWeather(weather);
          setWeatherStatus("");
          setRiskForm((current) => ({ ...current, weather: weather.weather }));
        }
      })
      .catch((weatherError) => {
        if (active) {
          setWeatherStatus(weatherError.message);
          setRiskForm((current) => ({ ...current, weather: "unknown" }));
        }
      });

    return () => {
      active = false;
    };
  }, [riskPlace]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (locationWatchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
    }
  }, []);

  useEffect(() => {
    if (!journey?.active) {
      return undefined;
    }
    const clock = setInterval(() => {
      const now = Date.now();
      setJourneyNow(now);
      setJourney((current) => {
        if (!current?.active) {
          return current;
        }
        const needsCheckIn = current.needsCheckIn || now >= current.nextCheckInAt;
        const arrivalOverdue = current.arrivalOverdue || now >= new Date(current.arrivalAt).getTime();
        if (needsCheckIn === current.needsCheckIn && arrivalOverdue === current.arrivalOverdue) {
          return current;
        }
        return { ...current, needsCheckIn, arrivalOverdue };
      });
    }, 1000);
    return () => clearInterval(clock);
  }, [journey?.active]);

  useEffect(() => {
    if (!journey?.active || (!journey.needsCheckIn && !journey.arrivalOverdue)) {
      return;
    }
    if (journeyAlertSentRef.current === journey.startedAt) {
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      setJourneyError("Enter a valid trusted contact email before starting a journey to enable automatic alerts.");
      return;
    }

    journeyAlertSentRef.current = journey.startedAt;
    const triggerSource = journey.arrivalOverdue ? "journey_overdue" : "journey_missed_checkin";
    const message = journey.arrivalOverdue
      ? `My expected arrival time for my journey to ${journey.destination} has passed. Expected arrival: ${new Date(journey.arrivalAt).toLocaleString()}. Please check on me.`
      : `I missed a safety check-in during my journey to ${journey.destination}. Expected arrival: ${new Date(journey.arrivalAt).toLocaleString()}. Please check on me.`;
    setJourneyError("");
    setJourneyAlertResult({ sent: false, sending: true, message: "Sending an automatic alert to your trusted contact…" });
    api.prepareAlert({
      message,
      urgency: "High",
      location: emergencyLocationRef.current || null,
      recipient_email: recipientEmail,
      confirmed_by_user: false,
      trigger_source: triggerSource
    }).then(setJourneyAlertResult).catch((e) => {
      setJourneyError(e.message);
      setJourneyAlertResult({ sent: false, sending: false, message: e.message });
    });
  }, [journey?.active, journey?.arrivalOverdue, journey?.needsCheckIn, journey?.startedAt, journey?.arrivalAt, journey?.destination, recipientEmail]);

  function startJourney(event) {
    event.preventDefault();
    const arrivalAt = new Date(journeyArrivalInput).getTime();
    if (!journeyDestination.trim() || !Number.isFinite(arrivalAt) || arrivalAt <= Date.now()) {
      setJourneyError("Enter a destination and an expected arrival time in the future.");
      return;
    }
    const startedAt = Date.now();
    setJourneyError("");
    setJourneyAlertResult(null);
    journeyAlertSentRef.current = null;
    setJourneyNow(startedAt);
    setJourney({
      active: true,
      destination: journeyDestination.trim(),
      arrivalAt: new Date(arrivalAt).toISOString(),
      checkInIntervalMs: Number(journeyCheckInMinutes) * 60 * 1000,
      startedAt,
      nextCheckInAt: startedAt + Number(journeyCheckInMinutes) * 60 * 1000,
      needsCheckIn: false,
      arrivalOverdue: false
    });
  }

  function confirmJourneySafe() {
    if (!journey?.active) {
      return;
    }
    if (journey.arrivalOverdue) {
      setJourney({ ...journey, active: false, needsCheckIn: false });
      return;
    }
    setJourney({
      ...journey,
      needsCheckIn: false,
      nextCheckInAt: Date.now() + journey.checkInIntervalMs
    });
    setJourneyAlertResult(null);
  }

  function endJourney() {
    setJourney((current) => current ? { ...current, active: false, needsCheckIn: false } : current);
  }

  function toggleLocationSharing() {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported by this browser.");
      return;
    }

    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
      setIsLocationSharing(false);
      setLocationStatus("Location sharing stopped.");
      return;
    }

    setLocationStatus("Requesting location permission...");
    try {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          const position = {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy
          };
          const coordinates = `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
          emergencyLocationRef.current = coordinates;
          setEmergencyLocation(coordinates);
          setUserPosition(position);
          setIsLocationSharing(true);
          setLocationStatus(`Live location active · accuracy ±${Math.round(position.accuracy)} m`);
        },
        (geolocationError) => {
          if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
            navigator.geolocation.clearWatch(locationWatchRef.current);
            locationWatchRef.current = null;
            setIsLocationSharing(false);
            setLocationStatus("Location permission was denied. Allow access in your browser to use GPS.");
          } else {
            setLocationStatus("GPS is temporarily unavailable. Still waiting for a location update...");
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
      setIsLocationSharing(true);
    } catch {
      setIsLocationSharing(false);
      setLocationStatus("Could not start GPS. Try again from a secure page or localhost.");
    }
  }

  function updateRisk(key, value) {
    setRiskForm((current) => ({ ...current, [key]: value }));
  }

  function navigateTo(path) {
    window.history.pushState(null, "", path);
    setError("");
    setShowLogin(isLoginPath(path));
    setActiveAgent(getAgentForPath(path)?.id || null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAgent(path) {
    navigateTo(path);
  }

  function returnHome() {
    navigateTo("/home");
  }

  function enterDemoDashboard(event) {
    event.preventDefault();
    navigateTo("/home");
  }

  async function runRisk(e) {
    e.preventDefault();
    setLoading("risk");
    setError("");
    setRiskError("");
    try {
      const result = await api.analyzeRisk({
        ...riskForm,
        incident_count: riskForm.incident_count === "" ? null : Number(riskForm.incident_count)
      });
      setRiskResult(result);
    } catch (e) {
      setRiskError(e.message);
    } finally {
      setLoading("");
    }
  }

  async function runRoutes() {
    if (!routeOrigin || !routeDestination) {
      setError("Choose a suggested start and destination before finding walking routes.");
      return;
    }
    setLoading("routes");
    setError("");
    try {
      const result = await api.walkingRoutes({
        origin: { lat: routeOrigin.lat, lon: routeOrigin.lon },
        destination: { lat: routeDestination.lat, lon: routeDestination.lon }
      });
      setRouteResult(result);
      setSelectedRouteId(result.routes[0]?.route_id || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  async function analyzeEmergencyMessage(message, { voiceTriggered = false } = {}) {
    setLoading("emergency");
    setError("");
    setAlertResult(null);
    setEmailSendConfirmed(false);
    if (voiceTriggered) {
      setEmergencyMessage(message);
      setVoiceStatus("Speech recognized. Running emergency triage...");
    }

    try {
      const result = await api.analyzeEmergency({
        message,
        location: emergencyLocationRef.current || null
      });
      setEmergencyResult(result);

      if (!result.distress_detected) {
        setAlertResult(null);
        if (voiceTriggered) {
          setVoiceStatus("Speech triage complete. No distress detected.");
        }
        return;
      }

      setEmailSendConfirmed(false);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
        const messageForUser = "SOS detected, but automatic email was not sent. Enter a valid trusted-contact email.";
        setError(messageForUser);
        if (voiceTriggered) {
          setVoiceStatus(messageForUser);
        }
        return;
      }

      setLoading("voice-alert");
      const alert = await api.prepareAlert({
        message,
        urgency: voiceTriggered ? "Critical" : result.urgency,
        location: emergencyLocationRef.current || null,
        recipient_email: recipientEmail,
        confirmed_by_user: false,
        trigger_source: voiceTriggered ? "voice_distress" : "typed_distress"
      });
      setAlertResult(alert);
      if (voiceTriggered) {
        setVoiceStatus(alert.message);
      }
    } catch (e) {
      setError(e.message);
      if (voiceTriggered) {
        setVoiceStatus(`SOS email failed: ${e.message}`);
      }
    } finally {
      setLoading("");
    }
  }

  async function runEmergency(e) {
    e.preventDefault();
    await analyzeEmergencyMessage(emergencyMessage);
  }

  function toggleVoiceRecognition() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("Voice recognition is not supported by this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    voiceHandledRef.current = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus("Listening for speech...");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();
      setEmergencyMessage(transcript);

      const finalSpeech = event.results[event.results.length - 1]?.isFinal;
      if (finalSpeech && transcript && !voiceHandledRef.current) {
        voiceHandledRef.current = true;
        setVoiceStatus("Speech recognized. Starting emergency triage...");
        recognition.stop();
        analyzeEmergencyMessage(transcript, { voiceTriggered: true });
      } else {
        setVoiceStatus("Transcript updated. Listening...");
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setVoiceStatus(event.error === "not-allowed"
        ? "Microphone access was denied. Allow microphone access in your browser to use voice recognition."
        : `Voice recognition error: ${event.error}.`);
    };
    recognition.onend = () => setIsListening(false);

    try {
      recognition.start();
    } catch (e) {
      setVoiceStatus(e.message || "Could not start voice recognition.");
    }
  }

  async function prepareAlert(event) {
    event.preventDefault();
    setLoading("alert");
    setError("");
    setEmailSendConfirmed(false);
    try {
      setAlertResult(await api.prepareAlert({
        message: emergencyMessage,
        urgency: emergencyResult?.urgency || "High",
        location: emergencyLocationRef.current || null,
        recipient_email: recipientEmail,
        confirmed_by_user: true
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  const walkingRoutes = routeResult?.routes || [];
  const livePlaceCenter = userPosition
    ? { lat: userPosition.lat, lon: userPosition.lng }
    : DEFAULT_PLACE_CENTER;

  return (
    <div className="app-shell">
      {showLogin ? (
        <main className="login-page">
          <section className="login-story">
            <div className="login-brand">
              <span className="login-brand-mark"><AgentIcon name="shield" /></span>
              <span>SafeCity <strong>Agent</strong></span>
            </div>
            <div className="login-story-content">
              <p className="eyebrow">YOUR PERSONAL SAFETY TOOLKIT</p>
              <h1>Move through your city with more confidence.</h1>
              <p>One place to plan routes, understand travel factors, send an SOS, and check in on your journey.</p>
              <div className="login-feature-list">
                {agents.map((agent) => (
                  <div className="login-feature" key={agent.id}>
                    <span className={`agent-nav-icon ${agent.icon}`}><AgentIcon name={agent.icon} /></span>
                    <span><strong>{agent.title}</strong><small>{agent.description}</small></span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="login-panel" aria-labelledby="login-heading">
            <div className="login-form-wrap">
              <p className="eyebrow">WELCOME</p>
              <h2 id="login-heading">Sign in to SafeCity</h2>
              <p className="muted">Continue to your safety dashboard.</p>
              <form className="login-form" onSubmit={enterDemoDashboard}>
                <label>
                  Email address
                  <input type="email" autoComplete="email" placeholder="Enter your email address" required />
                </label>
                <label>
                  Password
                  <input type="password" autoComplete="current-password" placeholder="Enter your password" required />
                </label>
                <button className="primary full" type="submit">Login</button>
              </form>
            </div>
            <p className="login-panel-footer">SafeCity Agent · Safety, one step at a time</p>
          </section>
        </main>
      ) : (
        <>
          <header className="hero">
            <div>
              <h1>SafeCity Agent</h1>
              <p className="hero-copy">
                An AI-assisted women's safety intelligence dashboard with transparent
                risk scoring, safer route comparison, emergency triage, and journey check-ins.
              </p>
            </div>
            <button className="hero-logout" type="button" onClick={() => navigateTo("/login")}>
              Logout
            </button>
          </header>

          {!activeAgent && (
            <nav className="agent-navigator" aria-label="Choose an agent">
              <div className="agent-navigator-heading">
                <p className="eyebrow">SAFECITY TOOLS</p>
                <h2>Choose an agent</h2>
                <p className="muted">Open the tool you need.</p>
              </div>
              <div className="agent-nav-grid">
                {agents.map((agent) => (
                  <button className="agent-nav-link" type="button" onClick={() => openAgent(agent.path)} key={agent.id}>
                    <span className={`agent-nav-icon ${agent.icon}`}><AgentIcon name={agent.icon} /></span>
                    <span className="agent-nav-copy">
                      <span className="agent-nav-number">{agent.number}</span>
                      <strong>{agent.title}</strong>
                      <span className="muted small">{agent.description}</span>
                    </span>
                    <span className="agent-nav-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </nav>
          )}

          {activeAgent && (
            <>
              <button className="home-button" type="button" onClick={returnHome}>
                <span aria-hidden="true">←</span> Back to home
              </button>
              {error && <div className="error-banner">{error}</div>}
              <div className="notice">
                <strong>Safety notice:</strong> Places and walking routes come from OpenStreetMap
                data, and weather is fetched live. The risk score has no live crime feed and
                cannot guarantee safety. If you are in immediate danger, contact local
                emergency services directly.
              </div>
            </>
          )}

          {activeAgent && <main className="grid agent-view">
        {(!activeAgent || activeAgent === "risk-agent") && (
        <SectionCard
          id="risk-agent"
          title="1. Risk Prediction Agent"
          subtitle="A transparent demonstration score using your estimates and live weather—not live crime data."
        >
          <form onSubmit={runRisk} className="form-grid">
            <PlaceAutocomplete
              label="Area, landmark, or address"
              value={riskForm.location}
              center={livePlaceCenter}
              placeholder="Search a real place"
              onChange={(value) => {
                updateRisk("location", value);
                updateRisk("weather", "unknown");
                setRiskPlace(null);
                setRiskResult(null);
              }}
              onSelect={(place) => {
                updateRisk("location", place.label);
                setRiskPlace(place);
                setRiskResult(null);
              }}
            />
            <label>
              Time
              <input type="time" value={riskForm.time} onChange={(e) => updateRisk("time", e.target.value)} />
            </label>
            <label>
              Crowd density (your estimate)
              <select value={riskForm.crowd_density} onChange={(e) => updateRisk("crowd_density", e.target.value)}>
                <option value="unknown">Unknown</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Lighting (your estimate)
              <select value={riskForm.lighting} onChange={(e) => updateRisk("lighting", e.target.value)}>
                <option value="unknown">Unknown</option>
                <option value="poor">Poor</option>
                <option value="average">Average</option>
                <option value="good">Good</option>
              </select>
            </label>
            <label>
              Incident count (optional; not live)
              <input
                type="number"
                min="0"
                max="100"
                value={riskForm.incident_count}
                onChange={(e) => updateRisk("incident_count", e.target.value)}
                placeholder="Leave blank if unknown"
              />
            </label>
            <label>
              Current weather
              <select
                value={riskForm.weather}
                onChange={(e) => updateRisk("weather", e.target.value)}
                disabled={Boolean(riskPlace && weatherStatus === "Loading current weather…")}
              >
                <option value="clear">Clear</option>
                <option value="rain">Rain</option>
                <option value="storm">Storm</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <p className="muted small full weather-note" aria-live="polite">
              {weatherStatus && (weatherStatus === "Loading current weather…" ? weatherStatus : `Live weather unavailable: ${weatherStatus}`)}
              {currentWeather && `Live weather · ${currentWeather.weather} · ${currentWeather.temperature_c}°C · ${currentWeather.observed_at}`}
              {!riskPlace && !weatherStatus && "Select a suggested place to load current weather. No crime or incident feed is connected."}
            </p>
            <button className="primary full" disabled={loading === "risk"}>
              {loading === "risk" ? "Analyzing..." : "Analyze risk"}
            </button>
          </form>

          {(riskResult || riskError) && (
            <div ref={riskOutputRef} tabIndex={-1} aria-live="polite">
              {riskError && <div className="error-banner" role="alert">{riskError}</div>}
              {riskResult && (
                <ResultBox title="Demonstration score (not a safety verdict)" tone={riskResult.risk_level === "High Risk" ? "danger" : riskResult.risk_level === "Medium Risk" ? "warning" : "success"}>
                  <div className="score-line">
                    <span className="big-score">{riskResult.risk_score}</span>
                    <span className="risk-label">{riskResult.risk_level}</span>
                  </div>
                  <p>{riskResult.ai_explanation}</p>
                  <h4>Factors</h4>
                  <ul>{riskResult.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
                  <h4>Recommendation</h4>
                  <p>{riskResult.recommendation}</p>
                  {Array.isArray(riskResult.limitations) && riskResult.limitations.length > 0 && (
                    <ul>{riskResult.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
                  )}
                  <p className="muted small">LLM used: {riskResult.llm_used ? "Yes" : "No — fallback mode"}</p>
                </ResultBox>
              )}
            </div>
          )}
        </SectionCard>
        )}

        {(!activeAgent || activeAgent === "route-agent") && (
        <SectionCard
          id="route-agent"
          title="2. Safe Route Agent"
          subtitle="Find real pedestrian routes and compare distance and estimated walking time. Routes are not safety-ranked."
        >
          <div className="form-grid route-form">
            <PlaceAutocomplete
              label="Start"
              value={routeOriginText}
              center={livePlaceCenter}
              placeholder="Search a start area"
              onChange={(value) => {
                setRouteOriginText(value);
                setRouteOrigin(null);
                setRouteResult(null);
              }}
              onSelect={(place) => {
                setRouteOriginText(place.label);
                setRouteOrigin(place);
                setRouteResult(null);
              }}
            />
            <PlaceAutocomplete
              label="Destination"
              value={routeDestinationText}
              center={routeOrigin || livePlaceCenter}
              placeholder="Search your destination"
              onChange={(value) => {
                setRouteDestinationText(value);
                setRouteDestination(null);
                setRouteResult(null);
              }}
              onSelect={(place) => {
                setRouteDestinationText(place.label);
                setRouteDestination(place);
                setRouteResult(null);
              }}
            />
          </div>
          <button className="primary full route-search-button" onClick={runRoutes} disabled={loading === "routes" || !routeOrigin || !routeDestination}>
            {loading === "routes" ? "Finding walking routes..." : "Find walking routes"}
          </button>

          {routeResult && (
            <ResultBox title="OpenStreetMap walking routes" tone="success">
              <p>Choose a route to highlight it on the map. These are pedestrian directions, not real-time safety recommendations.</p>
              <div className="route-options">
                {walkingRoutes.map((route) => (
                <button
                  className={`route-option ${route.route_id === selectedRouteId ? "selected" : ""}`}
                  key={route.route_id}
                  type="button"
                  onClick={() => setSelectedRouteId(route.route_id)}
                >
                  <div>
                    <strong>{route.name}</strong>
                    <p className="muted small">{route.distance_km} km · about {route.duration_minutes} min walking</p>
                  </div>
                  {route.route_id === walkingRoutes[0]?.route_id && <span className="tag">Shortest</span>}
                </button>
                ))}
              </div>
              <div className="location-map-frame route-map-frame">
                <LocationMap
                  routes={walkingRoutes}
                  selectedRouteId={selectedRouteId}
                  origin={routeOrigin}
                  destination={routeDestination}
                />
              </div>
              <p className="muted small map-note">
                Map, place search, and pedestrian directions are provided by OpenStreetMap-powered services. Check local conditions before travelling.
              </p>
              {walkingRoutes.map((route) => route.route_id === selectedRouteId && (
                <details className="route-directions" key={`${route.route_id}-directions`}>
                  <summary>Walking directions for {route.name}</summary>
                  <ol>{route.instructions.map((instruction, index) => <li key={`${index}-${instruction}`}>{instruction}</li>)}</ol>
                </details>
              ))}
            </ResultBox>
          )}
        </SectionCard>
        )}

        {(!activeAgent || activeAgent === "emergency-agent") && (
        <SectionCard
          id="emergency-agent"
          title="3. Emergency Detection Agent"
          subtitle="Spoken or typed SOS messages automatically email the configured trusted contact."
        >
          <form onSubmit={runEmergency} className="stack">
            <div className="voice-controls">
              <button
                className={isListening ? "voice-button listening" : "voice-button"}
                type="button"
                onClick={toggleVoiceRecognition}
                aria-pressed={isListening}
              >
                {isListening ? "Stop listening" : "Start voice detection"}
              </button>
              <span className="muted small" aria-live="assertive">
                {voiceStatus || "Microphone permission required. Speech triggers automatic triage."}
              </span>
            </div>
            <label>
              Message
              <textarea
                rows="4"
                placeholder="Speak or type: Someone is following me. I need help."
                value={emergencyMessage}
                onChange={(e) => setEmergencyMessage(e.target.value)}
                required
              />
            </label>
            <div className="location-sharing">
              <div>
                <strong>Live location</strong>
                <p className="muted small" aria-live="polite">{locationStatus}</p>
                {emergencyLocation && <p className="small">{emergencyLocation}</p>}
              </div>
              <button className="voice-button" type="button" onClick={toggleLocationSharing}>
                {isLocationSharing ? "Stop sharing location" : "Share my live location"}
              </button>
            </div>
            <div className="location-map-frame">
              <LocationMap location={userPosition} />
            </div>
            <p className="muted small map-note">
              Your GPS marker is private to this browser session; live map tiles require an internet connection.
            </p>
            <button className="primary full" disabled={loading === "emergency" || loading === "voice-alert"}>
              {loading === "voice-alert" ? "Sending automatic alert..." : loading === "emergency" ? "Analyzing..." : "Analyze emergency message"}
            </button>
          </form>

          <form onSubmit={prepareAlert} className="stack">
            <label className="stacked-label">
              Trusted contact email
              <input
                type="email"
                autoComplete="email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="trusted.contact@example.com"
                required
              />
              <span className="muted small">
                {emailAutomationConfigured === true && emailRecipientAllowed
                  ? "Automatic emails are enabled for detected typed/voice SOS and the first missed check-in or overdue arrival in each journey."
                  : emailAutomationConfigured === false
                    ? "Automatic email is not configured. Set SMTP_USERNAME, SMTP_APP_PASSWORD, and ALERT_ALLOWED_RECIPIENTS in backend/.env, then restart the backend."
                    : emailAutomationConfigured === true
                      ? "Add this trusted contact to ALERT_ALLOWED_RECIPIENTS in backend/.env to permit automatic delivery."
                      : "Checking automatic email configuration…"}
              </span>
            </label>
            <button
              className="danger full"
              type="submit"
              disabled={!emergencyResult || emergencyResult.distress_detected || loading === "alert" || loading === "voice-alert"}
            >
              {emergencyResult?.distress_detected
                ? "SOS email is automatic"
                : loading === "alert" ? "Preparing draft..." : "Prepare email draft"}
            </button>
          </form>

          {emergencyResult && (
            <ResultBox title="Emergency triage" tone={emergencyResult.distress_detected ? "danger" : "neutral"}>
              <div className="score-line">
                <span className="risk-label">{emergencyResult.distress_detected ? "Possible distress detected" : "No obvious distress keyword"}</span>
                <span className="tag">{emergencyResult.urgency}</span>
              </div>
              <p>{emergencyResult.recommended_action}</p>
              {emergencyResult.matched_terms?.length > 0 && (
                <p className="small muted">Matched terms: {emergencyResult.matched_terms.join(", ")}</p>
              )}
              <p className="muted small">LLM used: {emergencyResult.llm_used ? "Yes" : "No — fallback mode"}</p>
            </ResultBox>
          )}

          {alertResult && (
            <ResultBox title={alertResult.sent ? "Automatic email sent" : emailSendConfirmed ? "Email marked as sent" : "Email draft"} tone={alertResult.sent || emailSendConfirmed ? "success" : "warning"}>
              {alertResult.sent ? (
                <p role="status">{alertResult.message}</p>
              ) : emailSendConfirmed ? (
                <p role="status">
                  Thanks for confirming. Your trusted contact should receive the email shortly.
                </p>
              ) : (
                <>
                  <p>{alertResult.message}</p>
                  <p className="muted small">
                    The email has not been sent yet. Review it in Gmail and press Send.
                  </p>
                  <button
                    className="danger full"
                    type="button"
                    onClick={() => { window.open(createGmailComposeUrl(alertResult.payload), "_blank", "noopener,noreferrer"); }}
                  >
                    Open Gmail draft
                  </button>
                  <button
                    className="voice-button full"
                    type="button"
                    onClick={() => setEmailSendConfirmed(true)}
                  >
                    I sent the email
                  </button>
                </>
              )}
            </ResultBox>
          )}
        </SectionCard>
        )}

        {(!activeAgent || activeAgent === "journey-agent") && (
        <SectionCard
          id="journey-agent"
          title="4. Safe Journey Tracker"
          subtitle="Share your destination and check in periodically while you travel."
        >
          {!journey?.active ? (
            <form onSubmit={startJourney} className="form-grid">
              <label>
                Destination
                <input
                  value={journeyDestination}
                  onChange={(event) => setJourneyDestination(event.target.value)}
                  placeholder="Where are you going?"
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Expected arrival
                <input
                  type="datetime-local"
                  value={journeyArrivalInput}
                  onChange={(event) => setJourneyArrivalInput(event.target.value)}
                  required
                />
              </label>
              <label>
                Safety check-in interval
                <select
                  value={journeyCheckInMinutes}
                  onChange={(event) => setJourneyCheckInMinutes(Number(event.target.value))}
                >
                  <option value={1}>Every 1 minute (demo)</option>
                  <option value={5}>Every 5 minutes</option>
                  <option value={10}>Every 10 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                </select>
              </label>
              <button className="primary full" type="submit">Start journey</button>
            </form>
          ) : (
            <div className="journey-active">
              <div className="journey-summary">
                <span className="journey-status"><span aria-hidden="true" /> Journey active</span>
                <button className="voice-button" type="button" onClick={endJourney}>End journey</button>
              </div>
              <div className="journey-details">
                <div>
                  <span className="journey-label">DESTINATION</span>
                  <strong>{journey.destination}</strong>
                </div>
                <div>
                  <span className="journey-label">EXPECTED ARRIVAL</span>
                  <strong>{new Date(journey.arrivalAt).toLocaleString()}</strong>
                </div>
                {emergencyLocation && (
                  <div>
                    <span className="journey-label">LAST SHARED LOCATION</span>
                    <strong>{emergencyLocation}</strong>
                  </div>
                )}
              </div>
              {!journey.needsCheckIn && !journey.arrivalOverdue && (
                <p className="journey-countdown" role="status" aria-live="polite">
                  Next check-in in <strong>{formatCountdown(journey.nextCheckInAt - journeyNow)}</strong>
                </p>
              )}
              {journey.needsCheckIn && !journey.arrivalOverdue && (
                <div className="journey-warning" role="alert">
                  <strong>Safety check-in missed</strong>
                  <p>Please confirm that you are safe. SafeCity automatically emails your trusted contact after the first missed check-in or overdue arrival in this journey.</p>
                  <div className="journey-actions">
                    <button className="primary" type="button" onClick={confirmJourneySafe}>
                      I&apos;m safe, continue journey
                    </button>
                  </div>
                </div>
              )}
              {journey.arrivalOverdue && (
                <div className="journey-warning" role="alert">
                  <strong>Expected arrival time has passed</strong>
                  <p>Confirm you arrived safely. SafeCity automatically emails your trusted contact after the first missed check-in or overdue arrival in this journey.</p>
                  <div className="journey-actions">
                    <button className="primary" type="button" onClick={confirmJourneySafe}>
                      I arrived safely
                    </button>
                  </div>
                </div>
              )}
              {journeyAlertResult && (
                <div className={`result-box ${journeyAlertResult.sent ? "success" : journeyAlertResult.sending ? "warning" : "danger"} journey-draft`}>
                  <h3>{journeyAlertResult.sent ? "Automatic contact alert sent" : journeyAlertResult.sending ? "Sending automatic contact alert" : "Automatic contact alert failed"}</h3>
                  <p>{journeyAlertResult.message}</p>
                </div>
              )}
            </div>
          )}
          {journeyError && <p className="journey-error" role="alert">{journeyError}</p>}
          <p className="muted small journey-note">
            Check-ins run only while this dashboard remains open. Missed check-ins email the configured trusted contact; they do not contact emergency services.
          </p>
          <div className="journey-visual">
            <img
              className="journey-illustration"
              src="/safe-journey.svg"
              alt="Illustration of a safe route leading to a destination"
            />
            <div className="journey-steps" aria-label="Journey steps">
              <span><i aria-hidden="true">1</i> Plan</span>
              <span><i aria-hidden="true">2</i> Check in</span>
              <span><i aria-hidden="true">3</i> Arrive</span>
            </div>
          </div>
        </SectionCard>
        )}

          </main>}
        </>
      )}

    </div>
  );
}
