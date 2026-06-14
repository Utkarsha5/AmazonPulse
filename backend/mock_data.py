"""Deterministic mock datasets with REAL Amazon Tez ASINs for the hackathon prototype."""

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
            {
                "sku": "B091HTLXL3",
                "title": "MuscleBlaze Biozyme Performance Whey Protein 1kg",
                "quantity": 1,
                "price_inr": 3599,
                "bundle_reason": "GNN: post-workout recovery",
            },
            {
                "sku": "B0DSBV38MM",
                "title": "Fresh Yelakki Banana 500g",
                "quantity": 1,
                "price_inr": 49,
                "bundle_reason": "GNN: natural carb source",
            },
            {
                "sku": "B0DV595KM2",
                "title": "Liquid I.V Hydration Multiplier Electrolyte Drink Mix",
                "quantity": 1,
                "price_inr": 1113,
                "bundle_reason": "GNN: hydration pairing",
            },
            {
                "sku": "B0DSBW9M6W",
                "title": "Fresh Robusta Banana 500g",
                "quantity": 1,
                "price_inr": 32,
                "bundle_reason": "GNN: pre-gym energy",
            },
        ],
        "community_top_carts": [
            {
                "cart_name": "Koramangala Lifters Club",
                "purchase_count": 8402,
                "total_price": 4793,
                "items": [
                    "MuscleBlaze Whey 1kg",
                    "Fresh Yelakki Banana",
                    "Liquid I.V Electrolyte",
                ],
            },
            {
                "cart_name": "Indiranagar 6 AM Runners",
                "purchase_count": 6217,
                "total_price": 1194,
                "items": [
                    "Liquid I.V Electrolyte",
                    "Fresh Robusta Banana",
                    "Fresh Yelakki Banana",
                ],
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
            {
                "sku": "B073WZFMH4",
                "title": "Sri Bhagyalakshmi Maida 1kg",
                "quantity": 1,
                "price_inr": 60,
                "bundle_reason": "GNN: base ingredient",
            },
            {
                "sku": "B0FWRNLQ1T",
                "title": "Suguna Delfrez Fit Eggs 6 Pcs",
                "quantity": 1,
                "price_inr": 80,
                "bundle_reason": "GNN: binding agent",
            },
            {
                "sku": "B004KFHIBK",
                "title": "Weikfield Baking Powder 100g",
                "quantity": 1,
                "price_inr": 36,
                "bundle_reason": "GNN: leavening agent",
            },
            {
                "sku": "B0BFX79VRQ",
                "title": "The Select Aisle Vanilla Flavour Essence 100ml",
                "quantity": 1,
                "price_inr": 146,
                "bundle_reason": "GNN: flavor enhancer",
            },
        ],
        "community_top_carts": [
            {
                "cart_name": "HSR Home Bakers Circle",
                "purchase_count": 9104,
                "total_price": 322,
                "items": [
                    "Weikfield Baking Powder",
                    "Weikfield Baking Soda",
                    "Vanilla Essence",
                ],
            },
            {
                "cart_name": "Whitefield Cupcake Moms",
                "purchase_count": 7350,
                "total_price": 176,
                "items": ["Suguna Eggs 6 Pcs", "Maida 1kg", "Baking Soda"],
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
            {
                "sku": "B004IF24XE",
                "title": "Kurkure Masala Munch Namkeen 75g",
                "quantity": 1,
                "price_inr": 20,
                "bundle_reason": "GNN: movie staple",
            },
            {
                "sku": "B002YZHXH2",
                "title": "Lay's India's Magic Masala Chips 48g",
                "quantity": 2,
                "price_inr": 22,
                "bundle_reason": "GNN: shareable snack",
            },
            {
                "sku": "B07G1RP4FW",
                "title": "Coca-Cola Diet Coke Soft Drink Can 300ml",
                "quantity": 1,
                "price_inr": 38,
                "bundle_reason": "GNN: beverage pairing",
            },
            {
                "sku": "B077JSZ95H",
                "title": "Britannia Classic Little Hearts 70g",
                "quantity": 1,
                "price_inr": 21,
                "bundle_reason": "GNN: sweet snack pairing",
            },
        ],
        "community_top_carts": [
            {
                "cart_name": "Bellandur Binge Watchers",
                "purchase_count": 11240,
                "total_price": 101,
                "items": [
                    "Kurkure Masala Munch",
                    "Coca-Cola Diet Coke",
                    "Lay's Magic Masala",
                ],
            },
            {
                "cart_name": "Jayanagar Friday Film Club",
                "purchase_count": 8891,
                "total_price": 73,
                "items": [
                    "Bingo Chilli Chips",
                    "Britannia Little Hearts",
                    "Bingo Tedhe Medhe",
                ],
            },
        ],
    },
    "fever": {
        "keywords": ["fever", "cold", "flu", "medicine", "sick", "cough", "unwell"],
        "intent_label": "wellness_recovery",
        "bundle_name": "Fever Recovery Care Kit",
        "confidence": 0.96,
        "graph_traversal": [
            "node:intent.health",
            "node:category.wellness",
            "node:bundle.fever_recovery",
        ],
        "cart_items": [
            {
                "sku": "B00IZPFQQU",
                "title": "Himalaya Koflet Lozenges 10 Pcs",
                "quantity": 1,
                "price_inr": 21,
                "bundle_reason": "GNN: cough relief",
            },
            {
                "sku": "B0BVB6PDBX",
                "title": "Kwality Rich & Real Tomato Soup 50g",
                "quantity": 2,
                "price_inr": 33,
                "bundle_reason": "GNN: comfort food",
            },
            {
                "sku": "B07NJJV2D6",
                "title": "Glucon-D Tangy Orange Energy Drink Mix 450g",
                "quantity": 1,
                "price_inr": 188,
                "bundle_reason": "GNN: rehydration",
            },
            {
                "sku": "B00CZ4SL32",
                "title": "Eno Lemon Flavour Fruit Salt 6 Pcs",
                "quantity": 1,
                "price_inr": 54,
                "bundle_reason": "GNN: acidity relief",
            },
        ],
        "community_top_carts": [
            {
                "cart_name": "Malleshwaram Monsoon Care",
                "purchase_count": 15602,
                "total_price": 296,
                "items": ["Himalaya Koflet Lozenges", "Glucon-D Orange", "Tomato Soup"],
            },
            {
                "cart_name": "BTM Flu Fighters",
                "purchase_count": 9844,
                "total_price": 87,
                "items": ["Eno Fruit Salt", "Tomato Soup", "Himalaya Lozenges"],
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
            {
                "sku": "B0DQXPM7L7",
                "title": "Nandini Shubham Pasteurised Milk 500ml",
                "quantity": 1,
                "price_inr": 27,
                "bundle_reason": "Fallback: daily staple",
            },
            {
                "sku": "B0DSBW9M6W",
                "title": "Fresh Robusta Banana 500g",
                "quantity": 1,
                "price_inr": 32,
                "bundle_reason": "Fallback: quick energy",
            },
            {
                "sku": "B0FWRNLQ1T",
                "title": "Suguna Delfrez Fit Eggs 6 Pcs",
                "quantity": 1,
                "price_inr": 80,
                "bundle_reason": "Fallback: quick protein",
            },
            {
                "sku": "B0192UNUGO",
                "title": "Maggi 2-Minute Masala Instant Noodles 70g",
                "quantity": 2,
                "price_inr": 13,
                "bundle_reason": "Fallback: quick meal",
            },
        ],
        "community_top_carts": [
            {
                "cart_name": "Citywide Rain-Day Kits",
                "purchase_count": 22100,
                "total_price": 152,
                "items": ["Nandini Milk", "Maggi Noodles", "Fresh Banana"],
            },
            {
                "cart_name": "Late-Night Pantry Rescue",
                "purchase_count": 18750,
                "total_price": 73,
                "items": ["Maggi Noodles", "Britannia Little Hearts", "Kurkure"],
            },
        ],
    },
}

# Keyword priority order — first match wins (more specific intents first).
INTENT_MATCH_ORDER: list[str] = ["fever", "gym", "bake", "movie"]

STOCKOUT_CADENCE_PROFILES: dict[str, dict] = {
    "default": {
        "staple_item": "Nandini Shubham Pasteurised Milk 500ml",
        "sku": "B0DQXPM7L7",
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
}

FRICTIONLESS_LOYALTY_VECTORS: dict[str, dict] = {
    "default": {
        "user_id": "default",
        "top_recommendation": {
            "sku": "B0DQXPM7L7",
            "title": "Nandini Shubham Pasteurised Milk 500ml",
            "brand": "Nandini",
            "price_inr": 27,
            "probability": 0.97,
            "one_tap_action": "add_to_cart",
        },
        "brand_loyalty_scores": {
            "Nandini": 0.94,
            "Amul": 0.71,
            "Britannia": 0.55,
        },
        "personalization_vector_summary": [0.94, 0.71, 0.55, 0.49, 0.38],
        "rationale": "Dairy staple dominates historical basket vectors — optimal 1-tap replenishment candidate.",
    },
}

CONTEXT_BUNDLES: dict[str, dict] = {
    "rain": {
        "trigger_condition": "weather == 'rain'",
        "message": "\U0001f327\ufe0f Looks like rain! Perfect time for hot snacks.",
        "bundle_name": "Monsoon Comfort Bundle",
        "price_inr": 66,
        "items": [
            "Maggi 2-Minute Masala Noodles",
            "Kwality Tomato Soup",
            "Kurkure Masala Munch",
        ],
    },
    "morning": {
        "trigger_condition": "hour >= 6 and hour <= 10",
        "message": "\U0001f305 Good morning! Running low on breakfast essentials?",
        "bundle_name": "Morning Rush Pack",
        "price_inr": 139,
        "items": ["Nandini Milk 500ml", "Fresh Robusta Banana", "Suguna Eggs 6 Pcs"],
    },
}
