"""Deterministic mock datasets simulating ML model outputs for the hackathon prototype."""

INTENT_BUNDLES: dict[str, dict] = {
    "gym": {
        "keywords": ["gym", "workout", "protein", "fitness", "exercise", "whey"],
        "intent_label": "fitness_fuel",
        "bundle_name": "Pre-Workout Power Pack",
        "confidence": 0.93,
        "graph_traversal": [
            "node:intent.fitness",
            "node:category.sports_nutrition",
            "node:bundle.gym_starter",
        ],
        "cart_items": [
            {"sku": "B0WHEY1KG", "title": "Optimum Nutrition Whey Protein 1 kg", "quantity": 1, "price_inr": 3299, "bundle_reason": "GNN: post-workout recovery"},
            {"sku": "B0BANANA6", "title": "Fresh Bananas (6 pcs)", "quantity": 1, "price_inr": 48, "bundle_reason": "GNN: natural carb source"},
            {"sku": "B0WATER1L", "title": "Electrolyte Water 1 L (Pack of 6)", "quantity": 1, "price_inr": 180, "bundle_reason": "GNN: hydration pairing"},
            {"sku": "B0GRANOLA", "title": "MuscleBlaze High Protein Granola 400 g", "quantity": 1, "price_inr": 299, "bundle_reason": "GNN: pre-gym energy"},
        ],
        "community_top_carts": [
            {
                "cart_name": "Koramangala Lifters Club",
                "purchase_count": 8402,
                "total_price": 4120,
                "items": ["Whey Isolate 1 kg", "Peanut Butter 340 g", "Creatine Monohydrate 100 g"],
            },
            {
                "cart_name": "Indiranagar 6 AM Runners",
                "purchase_count": 6217,
                "total_price": 2890,
                "items": ["Energy Gel (5 pack)", "Coconut Water 1 L", "Mixed Nuts 200 g"],
            },
        ],
    },
    "bake": {
        "keywords": ["bake", "cake", "baking", "oven", "dessert", "pastry"],
        "intent_label": "baking_dessert",
        "bundle_name": "Weekend Cake Studio Kit",
        "confidence": 0.94,
        "graph_traversal": [
            "node:intent.baking",
            "node:category.dessert",
            "node:bundle.cake_starter_kit",
        ],
        "cart_items": [
            {"sku": "B0FLOUR500", "title": "Organic All-Purpose Flour 500 g", "quantity": 1, "price_inr": 89, "bundle_reason": "GNN: base ingredient"},
            {"sku": "B0SUGAR1KG", "title": "Refined Sugar 1 kg", "quantity": 1, "price_inr": 52, "bundle_reason": "GNN: sweetener"},
            {"sku": "B0EGGS12", "title": "Farm Fresh Eggs (12 pack)", "quantity": 1, "price_inr": 96, "bundle_reason": "GNN: binding agent"},
            {"sku": "B0COCOA200", "title": "Dutch Process Cocoa Powder 200 g", "quantity": 1, "price_inr": 245, "bundle_reason": "GNN: flavor enhancer"},
        ],
        "community_top_carts": [
            {
                "cart_name": "HSR Home Bakers Circle",
                "purchase_count": 9104,
                "total_price": 678,
                "items": ["Vanilla Extract 30 ml", "Baking Powder 100 g", "Butter Unsalted 500 g"],
            },
            {
                "cart_name": "Whitefield Cupcake Moms",
                "purchase_count": 7350,
                "total_price": 845,
                "items": ["Sprinkles Mix 150 g", "Whipped Cream 250 g", "Chocolate Chips 200 g"],
            },
        ],
    },
    "movie": {
        "keywords": ["movie", "popcorn", "snacks", "netflix", "film", "watch"],
        "intent_label": "entertainment_snacking",
        "bundle_name": "Movie Night Munch Box",
        "confidence": 0.91,
        "graph_traversal": [
            "node:intent.leisure",
            "node:category.snacks",
            "node:bundle.movie_night",
        ],
        "cart_items": [
            {"sku": "B0POPCORNM", "title": "Butter Popcorn Microwavable 3-pack", "quantity": 1, "price_inr": 149, "bundle_reason": "GNN: movie staple"},
            {"sku": "B0CHIPS150", "title": "Classic Salted Potato Chips 150 g", "quantity": 2, "price_inr": 40, "bundle_reason": "GNN: shareable snack"},
            {"sku": "B0COLA2L", "title": "Cola Soft Drink 2 L", "quantity": 1, "price_inr": 90, "bundle_reason": "GNN: beverage pairing"},
            {"sku": "B0NACHOS", "title": "Cheese Nachos with Salsa Dip 175 g", "quantity": 1, "price_inr": 99, "bundle_reason": "GNN: binge-watch pairing"},
        ],
        "community_top_carts": [
            {
                "cart_name": "Bellandur Binge Watchers",
                "purchase_count": 11240,
                "total_price": 520,
                "items": ["Microwave Popcorn 3-pack", "Dark Chocolate Bar", "Ginger Ale 750 ml"],
            },
            {
                "cart_name": "Jayanagar Friday Film Club",
                "purchase_count": 8891,
                "total_price": 610,
                "items": ["Masala Peanuts 200 g", "Iced Tea 1 L", "Nachos Cheese 150 g"],
            },
        ],
    },
    "fever": {
        "keywords": ["fever", "cold", "flu", "medicine", "paracetamol", "sick", "cough"],
        "intent_label": "wellness_recovery",
        "bundle_name": "Fever Recovery Care Kit",
        "confidence": 0.96,
        "graph_traversal": [
            "node:intent.health",
            "node:category.wellness",
            "node:bundle.fever_recovery",
        ],
        "cart_items": [
            {"sku": "B0PARA500", "title": "Paracetamol 500 mg (15 tablets)", "quantity": 1, "price_inr": 35, "bundle_reason": "GNN: fever reducer"},
            {"sku": "B0ORS", "title": "Electral ORS Powder (5 sachets)", "quantity": 1, "price_inr": 62, "bundle_reason": "GNN: rehydration"},
            {"sku": "B0SOUP", "title": "Instant Chicken Soup Mix 55 g", "quantity": 2, "price_inr": 45, "bundle_reason": "GNN: comfort food"},
            {"sku": "B0VAPOR", "title": "Vicks Vaporub 25 ml", "quantity": 1, "price_inr": 125, "bundle_reason": "GNN: congestion relief"},
        ],
        "community_top_carts": [
            {
                "cart_name": "Malleshwaram Monsoon Care",
                "purchase_count": 15602,
                "total_price": 340,
                "items": ["Cough Syrup 100 ml", "Hot Water Bag", "Tulsi Green Tea 25 bags"],
            },
            {
                "cart_name": "BTM Flu Fighters",
                "purchase_count": 9844,
                "total_price": 410,
                "items": ["Thermometer Digital", "Vitamin C Tablets", "Khichdi Ready Mix 200 g"],
            },
        ],
    },
    "emergency_essentials": {
        "keywords": [],
        "intent_label": "emergency_essentials",
        "bundle_name": "Emergency Essentials",
        "confidence": 0.78,
        "graph_traversal": [
            "node:intent.fallback",
            "node:category.staples",
            "node:bundle.emergency_essentials",
        ],
        "cart_items": [
            {"sku": "B0MILK1L", "title": "Amul Taaza Milk 1 L", "quantity": 1, "price_inr": 56, "bundle_reason": "Fallback: daily staple"},
            {"sku": "B0BREAD", "title": "Whole Wheat Bread 400 g", "quantity": 1, "price_inr": 45, "bundle_reason": "Fallback: pantry base"},
            {"sku": "B0EGGS6", "title": "Farm Fresh Eggs (6 pack)", "quantity": 1, "price_inr": 54, "bundle_reason": "Fallback: quick protein"},
            {"sku": "B0WATER2L", "title": "Packaged Drinking Water 2 L", "quantity": 2, "price_inr": 35, "bundle_reason": "Fallback: hydration"},
        ],
        "community_top_carts": [
            {
                "cart_name": "Citywide Rain-Day Kits",
                "purchase_count": 22100,
                "total_price": 380,
                "items": ["Torch LED", "Candles (6 pack)", "Matchbox"],
            },
            {
                "cart_name": "Late-Night Pantry Rescue",
                "purchase_count": 18750,
                "total_price": 290,
                "items": ["Instant Noodles 2-pack", "Biscuits 200 g", "Tea Bags 25 count"],
            },
        ],
    },
}

# Keyword priority order — first match wins (more specific intents first).
INTENT_MATCH_ORDER: list[str] = ["fever", "gym", "bake", "movie"]

STOCKOUT_CADENCE_PROFILES: dict[str, dict] = {
    "default": {
        "staple_item": "Amul Taaza Milk 1 L",
        "sku": "B0MILK1L",
        "category": "dairy_staple",
        "reorder_due_in_days": 1,
        "last_order_days_ago": 2,
        "typical_cadence_days": 3,
        "confidence_score": 0.91,
        "pin_code": "560001",
        "pin_code_aggregates": {
            "560001": {
                "households_tracked": 1842,
                "avg_reorder_cadence_days": 2.8,
                "stockout_risk_index": 0.87,
                "localized_confidence": 0.91,
            }
        },
        "alert_message": "Milk is due for reorder based on your 3-day cadence and Bengaluru 560001 demand signals.",
    },
    "user_42": {
        "staple_item": "Aashirvaad Whole Wheat Atta 5 kg",
        "sku": "B0ATTA5KG",
        "category": "pantry_staple",
        "reorder_due_in_days": 2,
        "last_order_days_ago": 12,
        "typical_cadence_days": 14,
        "confidence_score": 0.88,
        "pin_code": "110001",
        "pin_code_aggregates": {
            "110001": {
                "households_tracked": 2310,
                "avg_reorder_cadence_days": 13.5,
                "stockout_risk_index": 0.79,
                "localized_confidence": 0.88,
            }
        },
        "alert_message": "Atta reorder predicted — Delhi 110001 cohort shows elevated pantry depletion this week.",
    },
}

FRICTIONLESS_LOYALTY_VECTORS: dict[str, dict] = {
    "default": {
        "user_id": "default",
        "top_recommendation": {
            "sku": "B0FP1RM3BX",
            "title": "Sattviko Roasted Mint Makhana",
            "brand": "Sattviko",
            "price_inr": 130,
            "probability": 0.94,
            "one_tap_action": "add_to_cart",
        },
        "brand_loyalty_scores": {
            "Sattviko": 0.82,
            "4700BC": 0.71,
            "Happilo": 0.65,
        },
        "personalization_vector_summary": [0.82, 0.71, 0.65, 0.58, 0.44],
        "rationale": "Highest implicit affinity from repeat 1-tap purchases in the healthy-snacks cluster.",
    },
    "user_7": {
        "user_id": "user_7",
        "top_recommendation": {
            "sku": "B0MILK1L",
            "title": "Amul Taaza Milk 1 L",
            "brand": "Amul",
            "price_inr": 56,
            "probability": 0.97,
            "one_tap_action": "add_to_cart",
        },
        "brand_loyalty_scores": {
            "Amul": 0.94,
            "Nestle": 0.61,
            "Britannia": 0.55,
        },
        "personalization_vector_summary": [0.94, 0.61, 0.55, 0.49, 0.38],
        "rationale": "Dairy staple dominates historical basket vectors — optimal 1-tap replenishment candidate.",
    },
}
