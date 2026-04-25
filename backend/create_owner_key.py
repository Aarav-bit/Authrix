"""
Create owner API key with unlimited access
"""

from auth import create_api_key, load_api_keys, save_api_keys, hash_key

# Create owner key
owner_email = "owner@authrix.ai"
owner_key = create_api_key(owner_email, "owner")

# Update to unlimited tier
keys = load_api_keys()
key_hash = hash_key(owner_key)
keys[key_hash]["tier"] = "owner"
keys[key_hash]["unlimited"] = True
save_api_keys(keys)

print("\n" + "="*60)
print("🎉 OWNER API KEY CREATED")
print("="*60)
print(f"\n📧 Email: {owner_email}")
print(f"🔑 API Key: {owner_key}")
print(f"⭐ Tier: Owner (Unlimited)")
print(f"\n💡 Add this to your requests:")
print(f'   X-API-Key: {owner_key}')
print(f"\n📝 Save this key securely - it won't be shown again!")
print("="*60 + "\n")
