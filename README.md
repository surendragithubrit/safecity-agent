# SafeCity Agent

A beginner-friendly final-year project prototype for an AI-assisted women's safety platform.

SafeCity Agent combines:

- Transparent, rule-based safety scoring
- Prompt-driven AI agents
- Optional Google Gemini explanations
- OpenStreetMap-powered place suggestions and real pedestrian route geometry
- Current weather lookups for selected places
- Browser GPS location with an OpenStreetMap map
- Text-based emergency analysis and automatic voice triage
- Safe journey tracking with arrival estimates and periodic check-ins
- Automatic email alerts for detected SOS in voice or typed messages, and the first missed check-in or overdue arrival in a journey
- User-reviewed email drafts for manually analyzed non-SOS messages
- A demo login screen, a home-page agent selector, and separate pages for all four agents
- Illustrated icons for Risk Prediction, Safe Routes, Emergency SOS, and Journey Tracker
- Responsive login, agent selector, and dashboard layouts
- Custom SafeCity browser-tab icon
- React frontend
- Python FastAPI backend
- SQLite persistence

> **Important:** This is an educational prototype. It does not predict crimes, guarantee safety, replace emergency services, or automatically contact police. Place search and walking routes use live OpenStreetMap-powered services, and weather is fetched live. The risk score is only a demonstration based on user-entered crowd, lighting, and incident estimates plus weather; no live crime or incident feed is connected.

The login form is currently a visual demo only: it accepts any valid email and non-empty password, does not authenticate or store credentials, and does not protect the agent pages. After clicking **Login**, the home page shows the four agent icons. Each icon opens its own URL: `/risk-prediction`, `/safe-routes`, `/emergency-sos`, or `/journey-tracker`. Use **Back to home** to return to the agent selector and **Logout** to return to `/login`.

Voice detection uses browser speech recognition and requires microphone permission. It works only while the dashboard is open in a compatible browser (such as Chrome or Edge). Every finalized spoken utterance and every typed emergency analysis runs emergency triage; detected SOS messages automatically send an email to the trusted contact entered in the dashboard when an email provider is configured and that address is allowlisted. Non-SOS typed messages do not trigger automatic email. Use HTTPS or localhost for microphone access.

Automatic email can use Brevo's HTTPS API or Gmail SMTP from the backend only. On Render Free, use Brevo's HTTPS API because Render blocks outbound SMTP ports. Credentials belong in the ignored `backend/.env` file or the hosting provider's environment settings, never in frontend code or source control. The selected recipient must also be listed in `ALERT_ALLOWED_RECIPIENTS`. Each journey sends at most one automatic alert, on the first missed check-in or overdue arrival. Journey monitoring runs only while the dashboard remains open; it is not a guaranteed background monitoring service.

Live location uses browser geolocation and requires permission. Choose **Share my live location** to start GPS updates; the browser must use HTTPS or localhost. The latest coordinates are used for emergency triage and included in email alerts when available. The map uses OpenStreetMap tiles and needs an internet connection. Place suggestions use Photon, walking routes use Valhalla, and current weather uses Open-Meteo. These services provide map, place, route, and weather data—not crime-safety information. Service availability and map-data coverage can vary.

---

## 1. Architecture

```text
React + Vite + Leaflet frontend
        +-- demo login and home-page agent selector
        +-- separate URL pages for Risk, Routes, SOS, and Journey agents
        +-- illustrated agent icons and SafeCity browser icon
        +-- Safe Journey check-ins and missed-check-in alerts
        |
        | HTTP/JSON
        v
FastAPI backend
        |
        +-- Risk Agent
        |     +-- deterministic demonstration score from user-entered factors
        |     +-- current weather from Open-Meteo for selected places
        |     +-- optional Gemini explanation
        |
        +-- Map and place services
        |     +-- Photon place suggestions
        |     +-- Valhalla pedestrian route alternatives
        |     +-- OpenStreetMap map tiles
        |
        +-- Emergency Agent
        |     +-- detect distress language
        |     +-- urgency classification
        |     +-- browser voice transcript sent to triage
        |
        +-- Safe Journey Tracker
        |     +-- destination and expected arrival time
        |     +-- periodic user check-ins while dashboard is open
        |     +-- automatic email on first missed check-in or overdue arrival
        |
        +-- Alert Agent
        |     +-- Brevo HTTPS API or SMTP email for typed/voice SOS and journey alerts
        |     +-- user-reviewed email drafts for non-SOS typed alerts
        |     +-- SMTP credentials remain backend-only
        |
        +-- SQLite
        |
        +-- Optional Google Gemini model
```

## 2. Prerequisites

Install:

- Python 3.10+
- `uv` (recommended Python package and environment manager)
- Node.js 18+
- npm
- Optional: Google Gemini for AI explanations

The application works without Gemini. In that case, it uses deterministic fallback responses. Live place search, weather, map tiles, and walking routes require an internet connection.

### Install uv for the first time on Windows

Open PowerShell and run the official installer:

```powershell
irm https://astral.sh/uv/install.ps1 | iex
```

Close and reopen PowerShell, then verify the installation:

```powershell
uv --version
```

### Install Node.js for the first time on Windows

Download and install the current Node.js LTS release from:

https://nodejs.org/en/download

After installation, close and reopen PowerShell, then verify Node.js and npm:

```powershell
node --version
npm --version
```

## 3. Backend setup with uv

Open PowerShell in the project directory:

```powershell
cd backend
uv python install 3.12.3
uv venv .venv --python 3.12.3
```

Activate the environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the backend dependencies with `uv`:

```powershell
uv pip install -r requirements.txt
```

Copy the environment template:

```powershell
Copy-Item .env.example .env
```

Edit `backend/.env` to configure Gemini, or leave the key empty to use fallback
mode. To enable automatic email through Brevo's HTTPS API, create a Brevo API
key and configure a verified sender, plus the allowed trusted-contact
recipient(s):

```env
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=verified-sender@example.com
BREVO_SENDER_NAME=SafeCity Agent
ALERT_ALLOWED_RECIPIENTS=trusted.contact@example.com
```

Brevo's sender address must be verified in your Brevo account. Add only trusted
recipients to `ALERT_ALLOWED_RECIPIENTS` (comma-separated for multiple
contacts), and enter an allowed address in the dashboard. Keep the API key in
`backend/.env`, which is ignored by Git, or your hosting provider's secret
environment settings. Never paste it into chat, frontend code, or a committed
file. On Render Free, add `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`,
`BREVO_SENDER_NAME`, and `ALERT_ALLOWED_RECIPIENTS` to the backend service's
environment settings; the Brevo API sends over HTTPS rather than blocked SMTP
ports. For local development, Gmail SMTP remains available with
`SMTP_USERNAME` and `SMTP_APP_PASSWORD`. When both providers are configured,
Brevo is preferred. The dashboard shows whether email is configured and
whether the selected contact is allowed. Automatic delivery failures are shown
in the dashboard and recorded in the alert log.

Non-SOS typed alerts remain drafts: review and send them from Gmail yourself.
Detected SOS alerts from typed messages and voice, along with journey alerts,
are sent automatically when their configured trigger occurs. This sends only
to the allowed trusted-contact address; it does not contact police or emergency
services.

Start the API:

```powershell
uvicorn app.main:app --reload --port 8000
```

If PowerShell blocks activation, install and run through the environment's
Python executable instead:

```powershell
uv pip install --python .venv\Scripts\python.exe -r requirements.txt
\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Backend URLs:

- API: http://127.0.0.1:8000
- Health check: http://127.0.0.1:8000/health

## 4. Frontend setup

Open a second PowerShell terminal from the project directory:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://localhost:5173
```

The frontend expects the backend at:

```text
http://127.0.0.1:8000
```

To change it, create `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Browser permissions and map

The browser asks separately for microphone and location access when those features are started. Microphone speech recognition depends on browser support. GPS requires permission and a secure context (`localhost` or HTTPS). Map tiles, place suggestions, route alternatives, and current weather require an internet connection. Routes show pedestrian geometry, distance, estimated walking time, and directions; they are not ranked by safety. Crime/incident data, lighting, and crowd levels are not live.

## 5. Optional Google Gemini AI

If Gemini is unavailable, the backend automatically uses deterministic fallback
responses.

### Google Gemini

Gemini API keys can be created in Google AI Studio:

https://aistudio.google.com/app/apikey

Google may require signing in with a Google account. The Gemini API has a free
tier with model and rate limits that can change; it is not unlimited production
access.

In `backend/.env`, use:

```env
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.5-flash-lite
```

Do not commit or share this key. Restart the backend after changing `.env`.


## 6. Sample inputs for every agent

Use these values directly in the dashboard UI.

### Risk Agent

Open **Risk Prediction** from the home page. Choose a suggested area and enter these demonstration inputs:

- Location: `College Road`
- Time: `21:30`
- Crowd density: `Low`
- Lighting: `Poor`
- Recent incident count: `4`
- Weather: `Clear`

Click **Analyze risk**.

With clear weather, this example produces a demonstration score of `76`. This
is not a real crime-risk prediction; lighting, crowd, and incident count are
user-provided estimates. The optional incident count is not fetched or verified
by the app; leave it blank when you do not have a reliable estimate.

For a lower-risk example, use:

- Location: `Main Market`
- Time: `10:00`
- Crowd density: `High`
- Lighting: `Good`
- Recent incident count: `0`
- Weather: `Clear`

Click **Analyze risk** again.

Crowd density and lighting can be set to `unknown`; leave the incident count
blank if you do not have an estimate. When you select a place suggestion, the
weather field is populated from current Open-Meteo conditions (and can be
changed manually).

### Safe Routes

Open **Safe Routes** from the home page. Type a start area and destination, then choose a
matching place suggestion for each. Click **Find walking routes** to load
pedestrian paths and directions. Choose an option to highlight it on the map.
Only distance and estimated walking time are compared; the app does not claim
any route is safer than another.

### Emergency SOS

Open **Emergency SOS** from the home page and enter a message such as:

- Message: `Someone is following me. I need help.`

Enter the trusted contact email configured in the backend allowlist. Click **Analyze emergency message**. To use voice instead, click **Start voice detection** and speak; each finalized utterance runs triage without pressing the analyze button. Detected SOS phrases trigger automatic email when Brevo or SMTP is configured and the recipient is allowed. Non-SOS typed alerts can be prepared as Gmail drafts. Select **Share my live location** to attach current GPS coordinates.

Other useful test messages are `I feel unsafe`, `There is an emergency`, and
`I am waiting for my friend at the market`. The first three should indicate
possible distress; the last should normally produce a low-urgency result.

### Alert delivery

The trusted contact email field can be changed to an address in
`ALERT_ALLOWED_RECIPIENTS`. A detected SOS in a typed message or recognized
voice transcript sends an automatic email when Brevo or SMTP is configured. For a
non-SOS typed message, after the emergency result appears, click **Prepare email
draft**, then **Open Gmail draft** and send it yourself.

### Safe Journey Tracker

Open **Journey Tracker** from the home page. Enter your destination and expected arrival
time, choose a check-in interval, then click **Start journey**. The tracker
shows the time until the next check-in. At each interval, confirm **I'm safe,
continue journey** to reset the timer. The first missed check-in or overdue
arrival automatically emails the allowed trusted contact. **End journey** stops
the tracker at any time.

Automatic email requires Brevo API or SMTP configuration, and the contact must be
allowed in `ALERT_ALLOWED_RECIPIENTS`. Check-in timers run only while the
dashboard stays open; they are not a background or guaranteed monitoring
service. Automatic alerts go only to the trusted contact, not emergency
services. The last shared GPS location is included when available.
An illustrated route below the tracker summarizes the three steps: plan, check
in, and arrive.

## 7. Project modules

```text
backend/
├── app/
│   ├── agents/
│   │   ├── risk_agent.py
│   │   ├── emergency_agent.py
│   │   └── alert_agent.py
│   ├── services/
│   │   ├── llm_service.py
│   │   ├── map_service.py
│   │   └── database.py
│   ├── config.py
│   ├── schemas.py
│   └── main.py
├── data/
└── requirements.txt

frontend/
├── public/
│   ├── agent-icons/
│   │   ├── emergency-sos.png
│   │   ├── journey-tracker.png
│   │   ├── risk-prediction.png
│   │   └── safe-routes.png
│   ├── safecity-mark.svg
│   └── safe-journey.svg
├── src/
│   ├── components/
│   │   ├── LocationMap.jsx
│   │   ├── PlaceAutocomplete.jsx
│   │   ├── ResultBox.jsx
│   │   └── SectionCard.jsx
│   ├── api.js
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── package.json
└── index.html
```

## 8. Complete UI demonstration flow

1. Start the backend with `uvicorn` on port `8000`.
2. Start the frontend with `npm run dev`.
3. Open the Vite URL, usually `http://localhost:5173`, and enter an email and password on the demo login page.
4. Click **Login**, then select one of the four agent icons on the home page. Each agent opens on its own URL.
5. In Risk Prediction, use the high-risk sample and click **Analyze risk**.
6. Confirm the score, factors, recommendation, and `LLM used` status.
7. Return to the home page, open Safe Routes, search for a real starting area and destination, choose the place suggestions,
   and click **Find walking routes** to see pedestrian paths and directions.
8. Return home and open Emergency SOS. Type `Someone is following me. I need help.` and click **Analyze emergency message**, or start voice detection and speak.
9. Enter a trusted contact email from the backend allowlist. A detected SOS sends an automatic email if Brevo or SMTP is configured. Non-SOS typed messages can be sent as a reviewed draft.
10. Return home and open Journey Tracker. Enter a destination, expected arrival, and check-in interval. Start the journey, then confirm safety at the check-in prompt; test the automatic alert by letting a check-in expire.
11. Optionally start **Share my live location** in Emergency SOS and grant GPS permission to see your position on the map.

If `LLM used` says `No`, check the provider settings, API key, model name, and
that the backend was restarted after changing `backend/.env`. The deterministic
fallback still allows the complete demo to run without an AI provider.

## 9. Academic evaluation ideas

You can evaluate:

- Risk-score consistency for predefined scenarios
- Walking-route distance and estimated-time accuracy
- Emergency message classification accuracy
- API response time
- LLM enabled vs. fallback mode
- Usability through a small user study

Use synthetic or ethically sourced public data. Do not present synthetic data as real crime statistics.

## 10. Future enhancements

- Live turn-by-turn navigation and rerouting
- Publicly sourced, validated incident datasets
- Authentication and trusted-contact management
- Configured, consent-based notification provider for automatic alerts
- Human-reviewed emergency escalation
- Model evaluation and prompt versioning
- Audit logs and privacy controls
- Deployment using Docker or Azure/AWS services
