# ⚡ Amazon Pulse

**Intent-first shopping for Amazon Now — because you shouldn't have to search for what you already know you need.**

Amazon Pulse is a Chrome extension that transforms Amazon's quick-commerce experience from search-first to intent-first. Tell Pulse what you're doing — baking a cake, hosting a movie night, fighting a cold — and it builds the perfect cart in one tap.

---

## The Problem

Quick-commerce today is still fundamentally a search engine:
- Users make **4–7 searches per order** to build a simple cart
- **23% of sessions** end with forgotten items
- No platform understands *why* you're shopping — only *what* you type

## The Solution

Amazon Pulse adds three intelligence layers to Amazon Now:

### 1. 🧠 Intent → Cart
Type "Bake a cake" and Pulse maps your intent to exact products via NLP keyword extraction and graph traversal. One input, complete bundle.

### 2. 🔔 Predict → Prevent  
Time-series cadence tracking predicts when you'll run out of staples (milk, eggs, coffee). Collaborative filtering across pin codes strengthens confidence. You'll never open an empty fridge again.

### 3. 🌧️ Context → Nudge
Weather, time-of-day, and behavioral signals trigger proactive bundle suggestions. Raining outside? Pulse offers chai & pakoda bundles before you even think about it.

---

## Demo

| Feature | What it does |
|---------|-------------|
| Smart Bundle | "Bake a cake" → 4 items, one tap |
| Predictive Restock | "Milk due tomorrow" → 1-tap reorder |
| Quick Restock | Surfaces repeat purchases automatically |
| Context Popup (Alt+R) | Weather-triggered bundle suggestions |
| Product Card Badges | Confidence scores + 1-Tap Buy on every card |
| Community Carts | Shows what your neighborhood is buying |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                      │
│                                                      │
│  content.js ──── Sidebar, cart override, card badges │
│  background.js ─ API relay (bypasses CSP)            │
│  styles.css ──── Full UI styling                     │
│  manifest.json ─ Permissions & content script config │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP via service worker
┌──────────────────────▼──────────────────────────────┐
│  FastAPI Backend (Python)                            │
│                                                      │
│  main.py ──────── Route definitions + CORS           │
│  services.py ──── Intent resolution, predictions     │
│  schemas.py ───── Pydantic request/response models   │
│  mock_data.py ─── Simulated ML model outputs         │
└─────────────────────────────────────────────────────┘
```

**Key design decisions:**
- All API calls route through `background.js` service worker to bypass Amazon's Content Security Policy
- Cart state persists in `chrome.storage.local` — survives page navigations and reloads
- SPA route watcher handles Amazon Now's single-page navigation without full reloads
- Pulse Cart UI injects directly into `#scrollableMainBody` — feels native to the page

---

## Setup & Run

### Prerequisites
- Python 3.10+
- Google Chrome
- Node.js (optional, for syntax checking)

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Server runs at `https://amazonpulse-1.onrender.com`. Health check: `https://amazonpulse-1.onrender.com/health`

### Extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Navigate to `https://www.amazon.in/tez/browse?qcbrand=qqfsWw9RkO`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/intent/resolve` | Resolve shopping intent to product bundle |
| GET | `/api/v1/predict/stockout/{user_id}` | Predict next restock date |
| GET | `/api/v1/frictionless/{user_id}` | Get personalized recommendation |
| POST | `/api/v1/frictionless/add` | 1-tap add item to cart |
| POST | `/api/v1/checkout` | Process checkout |
| POST | `/api/v1/context/trigger` | Context-aware bundle trigger |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3, vanilla JavaScript, CSS |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| State | chrome.storage.local |
| Communication | Service worker message relay |
| Data | Deterministic mock datasets (simulating ML outputs) |

---

## Features in Detail

### Intent Engine
- Keywords: gym, bake, movie, fever → mapped to curated bundles
- Fallback: unrecognized intents → Emergency Essentials bundle
- Confidence scoring simulates GNN traversal output

### Predictive Restock
- Per-user cadence profiles (e.g., milk every 3 days)
- Pin-code aggregation: "1,842 households in 560001 buy at same cadence"
- Stockout risk index per locality

### Context-Aware Popup
- Triggered via Alt+R (demo hotkey)
- Weather + time-of-day bundle matching
- Multiple bundle options to choose from

### Pulse Cart
- Merges items from all sources (bundles, restocks, 1-tap)
- Deduplicates by item name
- Accumulates total price
- Remove individual items
- Simulated checkout with order confirmation

---

## Folder Structure

```
AmazonPulse/
├── backend/
│   ├── main.py           # FastAPI app + routes
│   ├── services.py       # Business logic
│   ├── schemas.py        # Pydantic models
│   ├── mock_data.py      # Simulated ML datasets
│   └── requirements.txt  # Python dependencies
├── extension/
│   ├── manifest.json     # Extension config
│   ├── content.js        # Main content script
│   ├── background.js     # Service worker (API relay)
│   └── styles.css        # UI styles
├── .gitignore
├── README.md
└── DEMO_SCRIPT.md
```

---

## Team

Built for Amazon Hackathon 2026.
Built by Sankalp Gupta and Utkarsha Shrivastava.
---

## License

MIT
