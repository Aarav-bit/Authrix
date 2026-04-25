# 💳 Stripe Subscription Setup Guide

## Your Owner API Key

```
🔑 API Key: authrix_vx5b5HqXIEtAuhUJw92p-aU7Ucz34RtWHzpBCzbKqKE
⭐ Tier: Owner (Unlimited Access)
```

**Save this key securely!** You have unlimited analyses.

---

## Quick Start: Accept Payments in 30 Minutes

### Step 1: Create Stripe Account (5 min)

1. Go to https://dashboard.stripe.com/register
2. Sign up with your email
3. Complete business verification

### Step 2: Get API Keys (2 min)

1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)
3. Add to your environment:

```bash
# Windows
set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Linux/Mac
export STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

### Step 3: Create Products & Prices (10 min)

1. Go to https://dashboard.stripe.com/products
2. Click **+ Add product**

**Create these products:**

#### Product 1: Authrix Pro
- **Name:** Authrix Pro
- **Description:** 100 video analyses per month
- **Pricing:**
  - Monthly: $9.99/month (recurring)
  - Yearly: $99/year (recurring)
- Copy the **Price ID** (starts with `price_`)

#### Product 2: Authrix Business
- **Name:** Authrix Business
- **Description:** 1,000 video analyses per month
- **Pricing:**
  - Monthly: $49/month (recurring)
  - Yearly: $490/year (recurring)
- Copy the **Price ID**

### Step 4: Update Price IDs (2 min)

Edit `backend/stripe_integration.py`:

```python
PRICE_IDS = {
    "pro_monthly": "price_YOUR_PRO_MONTHLY_ID",
    "pro_yearly": "price_YOUR_PRO_YEARLY_ID",
    "business_monthly": "price_YOUR_BUSINESS_MONTHLY_ID",
    "business_yearly": "price_YOUR_BUSINESS_YEARLY_ID",
}
```

### Step 5: Set Up Webhooks (5 min)

1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**
3. **Endpoint URL:** `https://your-domain.com/api/stripe/webhook`
4. **Events to send:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add to environment:

```bash
set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

### Step 6: Test Payment (5 min)

```bash
# Start backend
python -m uvicorn main:app --port 8000

# Test checkout (in another terminal)
curl -X POST http://localhost:8000/api/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "plan": "pro_monthly",
    "success_url": "http://localhost:8000/success",
    "cancel_url": "http://localhost:8000/pricing"
  }'
```

You'll get a `checkout_url` - open it in your browser!

**Test Card Numbers:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Any future expiry date, any CVC

---

## Integration Examples

### Frontend: Create Checkout

```javascript
// When user clicks "Subscribe to Pro"
async function subscribeToPro() {
  const response = await fetch('http://localhost:8000/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user@example.com',
      plan: 'pro_monthly',
      success_url: window.location.origin + '/success',
      cancel_url: window.location.origin + '/pricing'
    })
  });
  
  const { checkout_url } = await response.json();
  window.location.href = checkout_url;  // Redirect to Stripe
}
```

### Backend: Use API with Key

```python
import requests

response = requests.post(
    'http://localhost:8000/analyze',
    headers={'X-API-Key': 'authrix_YOUR_KEY_HERE'},
    files={'file': open('video.mp4', 'rb')}
)

print(response.json())
```

### Extension: Add API Key

Edit `extension/background.js`:

```javascript
const API_KEY = 'authrix_vx5b5HqXIEtAuhUJw92p-aU7Ucz34RtWHzpBCzbKqKE';

async function submitBlob(chunks, mimeType, totalSize) {
  // ... existing code ...
  
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY  // Add this line
    },
    body: fd
  });
  
  // ... rest of code ...
}
```

---

## Pricing Page HTML

Create `pricing.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Authrix Pricing</title>
  <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
  <h1>Choose Your Plan</h1>
  
  <div class="pricing-cards">
    <!-- Free -->
    <div class="card">
      <h2>Free</h2>
      <p class="price">$0<span>/month</span></p>
      <ul>
        <li>10 analyses/month</li>
        <li>Browser extension</li>
        <li>2-min videos</li>
      </ul>
      <button onclick="window.location.href='/signup'">Get Started</button>
    </div>
    
    <!-- Pro -->
    <div class="card popular">
      <h2>Pro</h2>
      <p class="price">$9.99<span>/month</span></p>
      <ul>
        <li>100 analyses/month</li>
        <li>10-min videos</li>
        <li>API access</li>
        <li>Email support</li>
      </ul>
      <button onclick="subscribe('pro_monthly')">Subscribe</button>
    </div>
    
    <!-- Business -->
    <div class="card">
      <h2>Business</h2>
      <p class="price">$49<span>/month</span></p>
      <ul>
        <li>1,000 analyses/month</li>
        <li>Unlimited length</li>
        <li>White-label reports</li>
        <li>Priority support</li>
      </ul>
      <button onclick="subscribe('business_monthly')">Subscribe</button>
    </div>
  </div>
  
  <script>
    async function subscribe(plan) {
      const email = prompt('Enter your email:');
      if (!email) return;
      
      const response = await fetch('http://localhost:8000/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          plan,
          success_url: window.location.origin + '/success',
          cancel_url: window.location.origin + '/pricing'
        })
      });
      
      const { checkout_url } = await response.json();
      window.location.href = checkout_url;
    }
  </script>
</body>
</html>
```

---

## Go Live Checklist

### Before Launch:
- [ ] Switch to **Live mode** in Stripe Dashboard
- [ ] Update `STRIPE_SECRET_KEY` with live key (`sk_live_...`)
- [ ] Update webhook endpoint to production URL
- [ ] Test with real card (will charge!)
- [ ] Set up email notifications (welcome, payment failed, etc.)
- [ ] Add terms of service & privacy policy
- [ ] Set up customer support email

### After Launch:
- [ ] Monitor Stripe Dashboard for payments
- [ ] Set up Stripe Radar for fraud prevention
- [ ] Enable 3D Secure for EU customers
- [ ] Set up tax collection (Stripe Tax)
- [ ] Create refund policy

---

## Revenue Tracking

### Check Earnings:
```bash
# Get all API keys and their tiers
python -c "from auth import load_api_keys; import json; print(json.dumps(load_api_keys(), indent=2))"

# Check usage for a key
python -c "from auth import check_usage_limit; print(check_usage_limit('authrix_YOUR_KEY'))"
```

### Stripe Dashboard:
- **Revenue:** https://dashboard.stripe.com/revenue
- **Customers:** https://dashboard.stripe.com/customers
- **Subscriptions:** https://dashboard.stripe.com/subscriptions

---

## Support & Resources

- **Stripe Docs:** https://stripe.com/docs
- **Stripe Testing:** https://stripe.com/docs/testing
- **Webhook Testing:** https://stripe.com/docs/webhooks/test
- **Stripe CLI:** https://stripe.com/docs/stripe-cli

---

## Next Steps

1. **Deploy to production** (Heroku, AWS, DigitalOcean)
2. **Get a domain** (authrix.ai, authrix.com)
3. **Set up SSL** (Let's Encrypt, Cloudflare)
4. **Create landing page** (Webflow, Carrd, custom)
5. **Launch on Product Hunt**
6. **Start marketing!**

---

**Questions?** Open an issue or email support@authrix.ai

**Built with ❤️ by the Authrix Team**
