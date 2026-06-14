from mock_data import (
    FRICTIONLESS_LOYALTY_VECTORS,
    INTENT_BUNDLES,
    INTENT_MATCH_ORDER,
    STOCKOUT_CADENCE_PROFILES,
)
from schemas import (
    CheckoutResponse,
    CommunityCart,
    FrictionlessAddResponse,
    FrictionlessResponse,
    IntentResolveResponse,
    PinCodeAggregate,
    PrimaryBundle,
    StockoutAlertResponse,
    TopRecommendation,
)


def normalize_query(query: str) -> str:
    return " ".join(query.lower().strip().split())


def match_intent_key(query: str) -> tuple[str, str]:
    """
    Case-insensitive keyword scan. Returns (bundle_key, matched_keyword).
    Falls back to emergency_essentials when nothing matches.
    """
    normalized = normalize_query(query)

    for bundle_key in INTENT_MATCH_ORDER:
        bundle = INTENT_BUNDLES[bundle_key]
        for keyword in bundle["keywords"]:
            if keyword in normalized:
                return bundle_key, keyword

    return "emergency_essentials", "default"


def _build_primary_bundle(bundle: dict) -> PrimaryBundle:
    cart_items = bundle["cart_items"]
    cart_total = sum(item["quantity"] * item["price_inr"] for item in cart_items)
    return PrimaryBundle(
        bundle_name=bundle["bundle_name"],
        intent_label=bundle["intent_label"],
        confidence=bundle["confidence"],
        cart_items=cart_items,
        cart_total_inr=cart_total,
    )


async def resolve_intent(query: str) -> IntentResolveResponse:
    bundle_key, matched_keyword = match_intent_key(query)
    bundle = INTENT_BUNDLES[bundle_key]
    primary = _build_primary_bundle(bundle)
    community_carts = [CommunityCart(**cart) for cart in bundle["community_top_carts"]]

    return IntentResolveResponse(
        query=query,
        matched_keyword=matched_keyword,
        intent_label=bundle["intent_label"],
        confidence=bundle["confidence"],
        graph_traversal=bundle["graph_traversal"],
        primary_bundle=primary,
        community_top_carts=community_carts,
    )


def _lookup_profile(profiles: dict[str, dict], user_id: str) -> dict:
    return profiles.get(user_id, profiles["default"])


async def predict_stockout(user_id: str) -> StockoutAlertResponse:
    profile = _lookup_profile(STOCKOUT_CADENCE_PROFILES, user_id)
    aggregates = {
        pin: PinCodeAggregate(**data)
        for pin, data in profile["pin_code_aggregates"].items()
    }

    return StockoutAlertResponse(
        user_id=user_id,
        staple_item=profile["staple_item"],
        sku=profile["sku"],
        category=profile["category"],
        reorder_due_in_days=profile["reorder_due_in_days"],
        last_order_days_ago=profile["last_order_days_ago"],
        typical_cadence_days=profile["typical_cadence_days"],
        confidence_score=profile["confidence_score"],
        pin_code=profile["pin_code"],
        pin_code_aggregates=aggregates,
        alert_message=profile["alert_message"],
        model_tags=["time_series_cadence", "collaborative_filtering", "pin_code_aggregate"],
    )


def _generate_order_id(user_id: str, title: str, price: str) -> str:
    return f"PULSE-{user_id.upper()}-{abs(hash(title + price)) % 100000:05d}"


async def frictionless_add(user_id: str, title: str, price: str) -> FrictionlessAddResponse:
    order_id = _generate_order_id(user_id, title, price)
    return FrictionlessAddResponse(
        success=True,
        status="confirmed",
        order_id=order_id,
        message="1-Tap Pulse Buy completed via frictionless personalization vector.",
        user_id=user_id,
        product={"title": title, "price": price},
        checkout_latency_ms=38,
    )


async def process_checkout(user_id: str, title: str, price: str) -> CheckoutResponse:
    order_id = _generate_order_id(user_id, title, price)
    return CheckoutResponse(
        order_id=order_id,
        status="confirmed",
        message="1-Tap Pulse Buy checkout simulated successfully.",
        user_id=user_id,
        product={"title": title, "price": price},
        one_tap_confirmed=True,
        checkout_latency_ms=42,
    )


async def get_frictionless_recommendation(user_id: str) -> FrictionlessResponse:
    profile = _lookup_profile(FRICTIONLESS_LOYALTY_VECTORS, user_id)

    return FrictionlessResponse(
        user_id=user_id,
        top_recommendation=TopRecommendation(**profile["top_recommendation"]),
        brand_loyalty_scores=profile["brand_loyalty_scores"],
        personalization_vector_summary=profile["personalization_vector_summary"],
        rationale=profile["rationale"],
        model_tags=["implicit_feedback", "personalization_vectors", "one_tap_resolution"],
    )
    
from mock_data import CONTEXT_BUNDLES

async def resolve_context_trigger(hour: int, weather: str) -> dict | None:
    # Weather takes priority in our demo
    if weather.lower() in ["rain", "raining"]:
        return CONTEXT_BUNDLES["rain"]
    # Fallback to time-of-day
    if 6 <= hour <= 10:
        return CONTEXT_BUNDLES["morning"]
    return None
