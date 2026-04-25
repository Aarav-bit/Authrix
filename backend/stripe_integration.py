"""
Authrix - Stripe Subscription Integration
"""

import os
from typing import Optional
import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import logging

from auth import create_api_key, load_api_keys, save_api_keys, hash_key

logger = logging.getLogger(__name__)

# Set your Stripe secret key (get from https://dashboard.stripe.com/apikeys)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_YOUR_KEY_HERE")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_YOUR_WEBHOOK_SECRET")

router = APIRouter(prefix="/api/stripe", tags=["stripe"])

# Stripe Price IDs (create these in Stripe Dashboard)
PRICE_IDS = {
    "pro_monthly": "price_PRO_MONTHLY_ID",      # $9.99/month
    "pro_yearly": "price_PRO_YEARLY_ID",        # $99/year (2 months free)
    "business_monthly": "price_BUSINESS_MONTHLY_ID",  # $49/month
    "business_yearly": "price_BUSINESS_YEARLY_ID",    # $490/year
}

class CheckoutRequest(BaseModel):
    email: str
    plan: str  # "pro_monthly", "pro_yearly", "business_monthly", "business_yearly"
    success_url: str
    cancel_url: str

class PortalRequest(BaseModel):
    customer_id: str
    return_url: str

@router.post("/create-checkout-session")
async def create_checkout_session(request: CheckoutRequest):
    """
    Create a Stripe Checkout session for subscription.
    
    Usage:
    POST /api/stripe/create-checkout-session
    {
        "email": "user@example.com",
        "plan": "pro_monthly",
        "success_url": "https://authrix.ai/success",
        "cancel_url": "https://authrix.ai/pricing"
    }
    """
    try:
        price_id = PRICE_IDS.get(request.plan)
        if not price_id:
            raise HTTPException(status_code=400, detail=f"Invalid plan: {request.plan}")
        
        # Create Stripe Checkout Session
        session = stripe.checkout.Session.create(
            customer_email=request.email,
            payment_method_types=["card"],
            line_items=[{
                "price": price_id,
                "quantity": 1,
            }],
            mode="subscription",
            success_url=request.success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=request.cancel_url,
            metadata={
                "email": request.email,
                "plan": request.plan,
            },
        )
        
        return {"checkout_url": session.url, "session_id": session.id}
    
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/create-portal-session")
async def create_portal_session(request: PortalRequest):
    """
    Create a Stripe Customer Portal session for managing subscription.
    
    Usage:
    POST /api/stripe/create-portal-session
    {
        "customer_id": "cus_XXXXX",
        "return_url": "https://authrix.ai/account"
    }
    """
    try:
        session = stripe.billing_portal.Session.create(
            customer=request.customer_id,
            return_url=request.return_url,
        )
        return {"portal_url": session.url}
    
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.
    
    Events handled:
    - checkout.session.completed: Create API key when subscription starts
    - customer.subscription.updated: Update tier when subscription changes
    - customer.subscription.deleted: Downgrade to free when subscription cancels
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle the event
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await handle_checkout_completed(session)
    
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        await handle_subscription_updated(subscription)
    
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        await handle_subscription_deleted(subscription)
    
    return {"status": "success"}

async def handle_checkout_completed(session: dict):
    """Create API key when checkout completes."""
    email = session["metadata"]["email"]
    plan = session["metadata"]["plan"]
    customer_id = session["customer"]
    subscription_id = session["subscription"]
    
    # Determine tier from plan
    tier = "pro" if "pro" in plan else "business"
    
    # Create API key
    api_key = create_api_key(email, tier)
    
    # Store Stripe customer ID and subscription ID
    keys = load_api_keys()
    key_hash = hash_key(api_key)
    keys[key_hash]["stripe_customer_id"] = customer_id
    keys[key_hash]["stripe_subscription_id"] = subscription_id
    save_api_keys(keys)
    
    logger.info(f"Created {tier} API key for {email} (customer: {customer_id})")
    
    # TODO: Send welcome email with API key
    # send_email(email, "Welcome to Authrix!", f"Your API key: {api_key}")

async def handle_subscription_updated(subscription: dict):
    """Update tier when subscription changes."""
    customer_id = subscription["customer"]
    status = subscription["status"]
    
    # Find API key by customer ID
    keys = load_api_keys()
    for key_hash, key_data in keys.items():
        if key_data.get("stripe_customer_id") == customer_id:
            if status == "active":
                # Subscription is active - ensure tier is correct
                logger.info(f"Subscription active for {key_data['email']}")
            elif status in ("past_due", "unpaid"):
                # Payment failed - send warning
                logger.warning(f"Payment issue for {key_data['email']}")
            break

async def handle_subscription_deleted(subscription: dict):
    """Downgrade to free when subscription cancels."""
    customer_id = subscription["customer"]
    
    # Find API key and downgrade to free
    keys = load_api_keys()
    for key_hash, key_data in keys.items():
        if key_data.get("stripe_customer_id") == customer_id:
            keys[key_hash]["tier"] = "free"
            keys[key_hash]["active"] = False  # Deactivate key
            save_api_keys(keys)
            logger.info(f"Downgraded {key_data['email']} to free tier")
            break

# Pricing plans for frontend
PRICING_PLANS = {
    "free": {
        "name": "Free",
        "price": 0,
        "interval": "month",
        "analyses": 10,
        "features": [
            "10 video analyses per month",
            "Browser extension",
            "Max 2-minute videos",
            "Community support",
        ],
    },
    "pro": {
        "name": "Pro",
        "price_monthly": 9.99,
        "price_yearly": 99,
        "interval": "month",
        "analyses": 100,
        "features": [
            "100 analyses per month",
            "Up to 10-minute videos",
            "API access (100 calls/month)",
            "Priority processing",
            "Email support",
            "Batch upload",
        ],
        "popular": True,
    },
    "business": {
        "name": "Business",
        "price_monthly": 49,
        "price_yearly": 490,
        "interval": "month",
        "analyses": 1000,
        "features": [
            "1,000 analyses per month",
            "Unlimited video length",
            "API access (5,000 calls/month)",
            "White-label reports",
            "Slack/Teams integration",
            "Priority support",
            "Custom branding",
        ],
    },
    "enterprise": {
        "name": "Enterprise",
        "price": "Custom",
        "interval": "month",
        "analyses": "Unlimited",
        "features": [
            "Unlimited analyses",
            "On-premise deployment",
            "Custom model training",
            "SLA guarantees",
            "Dedicated support",
            "Multi-user accounts",
        ],
        "contact": True,
    },
}

@router.get("/pricing")
async def get_pricing():
    """Get pricing plans."""
    return PRICING_PLANS
