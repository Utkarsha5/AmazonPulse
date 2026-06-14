from pydantic import BaseModel, Field


class IntentResolveRequest(BaseModel):
    query: str = Field(..., min_length=1, examples=["Bake a cake"])


class ContextTriggerRequest(BaseModel):
    user_id: str = Field(default="demo_user")
    current_hour: int = Field(..., ge=0, le=23)
    weather_condition: str = Field(default="clear")


class ContextTriggerResponse(BaseModel):
    success: bool
    trigger_found: bool
    data: dict | None = None


class CartItem(BaseModel):
    sku: str
    title: str
    quantity: int
    price_inr: int
    bundle_reason: str


class CommunityCart(BaseModel):
    cart_name: str
    purchase_count: int
    total_price: int
    items: list[str]


class PrimaryBundle(BaseModel):
    bundle_name: str
    intent_label: str
    confidence: float
    cart_items: list[CartItem]
    cart_total_inr: int


class IntentResolveResponse(BaseModel):
    query: str
    matched_keyword: str
    intent_label: str
    confidence: float
    graph_traversal: list[str]
    primary_bundle: PrimaryBundle
    community_top_carts: list[CommunityCart]


class PinCodeAggregate(BaseModel):
    households_tracked: int
    avg_reorder_cadence_days: float
    stockout_risk_index: float
    localized_confidence: float


class StockoutAlertResponse(BaseModel):
    user_id: str
    staple_item: str
    sku: str
    category: str
    reorder_due_in_days: int
    last_order_days_ago: int
    typical_cadence_days: int
    confidence_score: float
    pin_code: str
    pin_code_aggregates: dict[str, PinCodeAggregate]
    alert_message: str
    model_tags: list[str]


class TopRecommendation(BaseModel):
    sku: str
    title: str
    brand: str
    price_inr: int
    probability: float
    one_tap_action: str


class FrictionlessResponse(BaseModel):
    user_id: str
    top_recommendation: TopRecommendation
    brand_loyalty_scores: dict[str, float]
    personalization_vector_summary: list[float]
    rationale: str
    model_tags: list[str]


class FrictionlessAddRequest(BaseModel):
    title: str = Field(..., min_length=1)
    price: str = Field(..., min_length=1)
    user_id: str = Field(default="user_123", examples=["user_123"])


class FrictionlessAddResponse(BaseModel):
    success: bool
    status: str
    order_id: str
    message: str
    user_id: str
    product: dict[str, str]
    checkout_latency_ms: int


class CheckoutRequest(BaseModel):
    user_id: str = Field(default="user_123", examples=["user_123"])
    title: str = Field(..., min_length=1)
    price: str = Field(..., min_length=1)


class CheckoutResponse(BaseModel):
    order_id: str
    status: str
    message: str
    user_id: str
    product: dict[str, str]
    one_tap_confirmed: bool
    checkout_latency_ms: int
