# DocuForge Stock Footage Proxy (Cloudflare Worker)

This zero-cost Cloudflare Worker proxy allows DocuForge to search **Pexels** and **Pixabay** video APIs live in the browser without exposing private API keys or encountering CORS restrictions.

---

## 1. Quick Deploy (Free Cloudflare Tier)

### Step 1: Install Wrangler CLI
```bash
npm install -g wrangler
# or use npx: npx wrangler
```

### Step 2: Authenticate with Cloudflare
```bash
npx wrangler login
```

### Step 3: Add Your Free API Keys as Secrets
Get free API keys:
- [Pexels API Key](https://www.pexels.com/api/) (200 requests/hr, 20,000/month free)
- [Pixabay API Key](https://pixabay.com/api/docs/) (100 requests/minute free)

Run:
```bash
cd tools/stock-proxy
npx wrangler secret put PEXELS_API_KEY
# Enter your Pexels key when prompted

npx wrangler secret put PIXABAY_API_KEY
# Enter your Pixabay key when prompted
```

### Step 4: Deploy
```bash
npx wrangler deploy
```

Wrangler will output your live proxy URL:
```
https://docuforge-stock-proxy.<your-subdomain>.workers.dev
```

---

## 2. Connect to DocuForge

In the DocuForge UI:
1. Open **⚙️ Advanced Customizations & Media Overrides**.
2. Set **Stock Proxy URL** to your deployed worker URL:
   ```
   https://docuforge-stock-proxy.<your-subdomain>.workers.dev
   ```
3. Alternatively, if running without a proxy, paste your free Pexels or Pixabay key directly into the settings. Keys are saved securely in your browser's `localStorage` and never sent anywhere else.
