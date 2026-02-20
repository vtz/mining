"""Feature catalog — single source of truth for toggleable add-ons.

To add a new sellable feature:
1. Add an entry here.
2. Use ``require_feature("key")`` in the relevant router.
3. Add ``featureKey`` to the corresponding frontend nav item.
No migration needed.
"""

from typing import Dict, Any

FEATURE_CATALOG: Dict[str, Dict[str, Any]] = {
    "goal_seek": {
        "name": "Goal Seek",
        "description": "Find break-even values for any variable",
        "default_enabled": True,  # backwards-compatible — on for all existing mines
        "icon": "search-plus",
    },
    "block_model": {
        "name": "Block Model",
        "description": "Import Deswik blocks, calculate NSR per block, monitor viability",
        "default_enabled": False,  # add-on — off by default
        "icon": "grid",
    },
    # Future features:
    # "advanced_alerts": { "name": "Advanced Alerts", ... },
    # "multi_metal": { "name": "Multi-Metal NSR", ... },
    # "api_access": { "name": "API Access", ... },
}
