from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    CheckoutRequest,
    CheckoutResponse,
    ContextTriggerRequest,
    ContextTriggerResponse,
    FrictionlessAddRequest,
    FrictionlessAddResponse,
    FrictionlessResponse,
    IntentResolveRequest,
    IntentResolveResponse,
    StockoutAlertResponse,
)
from services import (
    frictionless_add,
    get_frictionless_recommendation,
    predict_stockout,
    process_checkout,
    resolve_context_trigger,
    resolve_intent,
)

app = FastAPI(
    title="Amazon Pulse API",
    description="Hackathon prototype backend simulating NLP-GNN, cadence stockout, and frictionless personalization.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "amazon-pulse"}


@app.post("/api/v1/intent/resolve", response_model=IntentResolveResponse)
async def intent_resolve(payload: IntentResolveRequest) -> IntentResolveResponse:
    """
    NLP intent extractor + GNN graph traversal.
    Matches keywords (gym, bake, movie, fever) or returns Emergency Essentials.
    """
    return await resolve_intent(payload.query)


@app.get("/api/v1/predict/stockout/{user_id}", response_model=StockoutAlertResponse)
async def predict_stockout_route(user_id: str) -> StockoutAlertResponse:
    """Time-series cadence tracking with collaborative filtering by pin code."""
    return await predict_stockout(user_id)


@app.get("/api/v1/frictionless/{user_id}", response_model=FrictionlessResponse)
async def frictionless_route(user_id: str) -> FrictionlessResponse:
    """Implicit recommendation via predictive personalization vectors."""
    return await get_frictionless_recommendation(user_id)


@app.post("/api/v1/frictionless/add", response_model=FrictionlessAddResponse)
async def frictionless_add_route(
    payload: FrictionlessAddRequest,
) -> FrictionlessAddResponse:
    """1-tap add from scraped Tez product card (title + price)."""
    return await frictionless_add(payload.user_id, payload.title, payload.price)


@app.post("/api/v1/checkout", response_model=CheckoutResponse)
async def checkout_route(payload: CheckoutRequest) -> CheckoutResponse:
    """Legacy checkout alias — prefer /api/v1/frictionless/add."""
    return await process_checkout(payload.user_id, payload.title, payload.price)


@app.post("/api/v1/context/trigger", response_model=ContextTriggerResponse)
async def context_trigger_route(
    payload: ContextTriggerRequest,
) -> ContextTriggerResponse:
    """Zero-Search Context Engine: Returns bundles based on time/weather."""
    bundle = await resolve_context_trigger(
        payload.current_hour, payload.weather_condition
    )
    if bundle:
        return ContextTriggerResponse(success=True, trigger_found=True, data=bundle)
    return ContextTriggerResponse(success=True, trigger_found=False)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
