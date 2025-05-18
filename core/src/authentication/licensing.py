import uuid
from typing import Optional

# In‑memory store of issued keys → tier
_KEYS: dict[str, str] = {}

# Define which tiers satisfy which access levels
_ALLOWED_TIERS: dict[str, list[str]] = {
    "basic":     ["basic"],
    "small":     ["basic", "small"],
    "enterprise":["basic", "small", "enterprise"],
}

def issue_key(user_id: str, tier: str) -> str:
    """
    Generate a new API key for `user_id` with the given tier.
    """
    if tier not in _ALLOWED_TIERS:
        raise ValueError(f"Unknown tier {tier!r}")
    key = uuid.uuid4().hex
    _KEYS[key] = tier
    return key

def validate_key(key: Optional[str], required_tier: str = "basic") -> bool:
    """
    Return True if `key` exists and its tier covers `required_tier`.
    """
    if not key or key not in _KEYS:
        return False
    return _KEYS[key] in _ALLOWED_TIERS[required_tier]
