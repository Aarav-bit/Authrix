# Deploy Authrix to Hugging Face Spaces (Free)

## Why HF Spaces?
- FREE 16GB RAM
- FREE CPU (and optional GPU)
- Always-on (no sleep on free tier for public spaces)
- Built for AI apps exactly like this

---

## Step-by-Step Deployment

### 1. Create HuggingFace Account
Go to https://huggingface.co/join and sign up (free)

### 2. Create a New Space
1. Go to https://huggingface.co/new-space
2. Fill in:
   - **Space name:** authrix (or authrix-deepfake-detector)
   - **License:** MIT
   - **SDK:** Docker
   - **Visibility:** Public (required for free tier)
3. Click **Create Space**

### 3. Push Your Code

Install Git LFS first:
```bash
# Windows
winget install Git.Git
git lfs install
```

Then push:
```bash
# In your project root (E:\DeepFake Detect)
git init
git add .
git commit -m "Initial deployment"

# Add HuggingFace remote (replace YOUR_USERNAME)
git remote add hf https://huggingface.co/spaces/YOUR_USERNAME/authrix

# Push (will ask for HF username + token)
git push hf main
```

Get your HF token at: https://huggingface.co/settings/tokens
(Create a token with "write" permission)

### 4. Wait for Build
- Build takes 10-15 minutes (downloading models)
- Watch progress at: https://huggingface.co/spaces/YOUR_USERNAME/authrix

### 5. Update Extension API URL
Once deployed, your app will be at:
`https://YOUR_USERNAME-authrix.hf.space`

Update `extension/background.js`:
```javascript
const API_BASE = 'https://YOUR_USERNAME-authrix.hf.space';
```

Update `extension/popup.js`:
```javascript
const API_BASE = 'https://YOUR_USERNAME-authrix.hf.space';
```

Update `extension/content.js` (Open Authrix App button):
```javascript
window.open('https://YOUR_USERNAME-authrix.hf.space', '_blank');
```

---

## Limitations of Free HF Spaces

| Feature | Free Tier |
|---------|-----------|
| RAM | 16GB ✅ |
| CPU | 2 vCPUs ✅ |
| GPU | ❌ (CPU only) |
| Storage | 50GB ✅ |
| Sleep | Never (public spaces) ✅ |
| Custom domain | ❌ (need Pro $9/mo) |
| Private space | ❌ (need Pro) |

## Upgrade Options
- **HF Pro ($9/mo):** Custom domain, private spaces, more storage
- **HF GPU Space ($0.60/hr):** 10x faster inference with T4 GPU

---

## After Deployment

Your app will be live at:
`https://YOUR_USERNAME-authrix.hf.space`

Share this URL with anyone — no installation needed!

The browser extension will also work with this URL once you update `API_BASE`.
