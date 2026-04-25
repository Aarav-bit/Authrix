"""
Authrix - API Key Authentication & Usage Tracking
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
import json
from pathlib import Path

# Simple file-based storage (replace with database in production)
API_KEYS_FILE = Path("api_keys.json")
USAGE_FILE = Path("usage.json")

# Tier limits (analyses per month)
TIER_LIMITS = {
    "free": 10,
    "pro": 100,
    "business": 1000,
    "enterprise": 999999,
    "owner": 999999,  # Owner has unlimited access
}

def generate_api_key() -> str:
    """Generate a secure API key."""
    return f"authrix_{secrets.token_urlsafe(32)}"

def hash_key(api_key: str) -> str:
    """Hash API key for storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()

def create_api_key(email: str, tier: str = "free") -> str:
    """Create a new API key for a user."""
    api_key = generate_api_key()
    key_hash = hash_key(api_key)
    
    keys = load_api_keys()
    keys[key_hash] = {
        "email": email,
        "tier": tier,
        "created_at": datetime.now().isoformat(),
        "active": True,
    }
    save_api_keys(keys)
    
    return api_key

def validate_api_key(api_key: str) -> Optional[dict]:
    """Validate API key and return user info."""
    if not api_key:
        return None
    
    key_hash = hash_key(api_key)
    keys = load_api_keys()
    
    if key_hash not in keys:
        return None
    
    key_data = keys[key_hash]
    if not key_data.get("active", False):
        return None
    
    return key_data

def check_usage_limit(api_key: str) -> tuple[bool, int, int]:
    """
    Check if user has exceeded their monthly limit.
    Returns (allowed, used, limit).
    """
    key_data = validate_api_key(api_key)
    if not key_data:
        return False, 0, 0
    
    tier = key_data.get("tier", "free")
    
    # Owner has unlimited access
    if tier == "owner" or key_data.get("unlimited", False):
        return True, 0, 999999
    
    limit = TIER_LIMITS.get(tier, 10)
    
    # Get current month usage
    key_hash = hash_key(api_key)
    usage = load_usage()
    current_month = datetime.now().strftime("%Y-%m")
    
    if key_hash not in usage:
        usage[key_hash] = {}
    
    used = usage[key_hash].get(current_month, 0)
    
    return used < limit, used, limit

def increment_usage(api_key: str):
    """Increment usage counter for the current month."""
    key_hash = hash_key(api_key)
    usage = load_usage()
    current_month = datetime.now().strftime("%Y-%m")
    
    if key_hash not in usage:
        usage[key_hash] = {}
    
    usage[key_hash][current_month] = usage[key_hash].get(current_month, 0) + 1
    save_usage(usage)

def load_api_keys() -> dict:
    """Load API keys from file."""
    if not API_KEYS_FILE.exists():
        return {}
    return json.loads(API_KEYS_FILE.read_text())

def save_api_keys(keys: dict):
    """Save API keys to file."""
    API_KEYS_FILE.write_text(json.dumps(keys, indent=2))

def load_usage() -> dict:
    """Load usage data from file."""
    if not USAGE_FILE.exists():
        return {}
    return json.loads(USAGE_FILE.read_text())

def save_usage(usage: dict):
    """Save usage data to file."""
    USAGE_FILE.write_text(json.dumps(usage, indent=2))

# Create a demo API key on first run
if not API_KEYS_FILE.exists():
    demo_key = create_api_key("demo@authrix.ai", "pro")
    print(f"\n🔑 Demo API Key created: {demo_key}")
    print(f"   Tier: Pro (100 analyses/month)")
    print(f"   Add to requests: X-API-Key: {demo_key}\n")
