# Deploying ParenTech to Vercel (100% Free — $0/Month)

ParenTech is pre-configured to deploy on **Vercel Hobby ($0/mo)** using a free Serverless Postgres database (**Neon** or **Supabase**) with zero code changes needed after connecting environment variables.

## Step 1: Push Project to GitHub
Make sure your latest project files (including `api/index.js`, `vercel.json`, and `package.json` with `pg`) are pushed to your GitHub repository.

## Step 2: Import into Vercel
1. Sign up or log in at **[vercel.com](https://vercel.com)** with GitHub (Hobby Plan is free forever, no credit card needed).
2. Click **Add New → Project** and select your **ParenTech** repository.
3. Leave Framework Preset as **Other** and click **Deploy** (we will attach the database right away).

## Step 3: Add a Free Postgres Database ($0)
1. Open your deployed project in the Vercel Dashboard → **Storage** tab.
2. Click **Create Database** → choose **Neon (Serverless Postgres)** (Free Tier: 512 MB storage, no credit card) *or* connect an existing **Supabase** Postgres `DATABASE_URL`.
3. Attach it to your project — Vercel automatically adds `DATABASE_URL`.

## Step 4: Set `SESSION_SECRET`
1. Go to **Settings → Environment Variables**.
2. Add:
   - Name: `SESSION_SECRET`
   - Value: Any random 32+ character string (e.g. run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` locally).

*(Optional)* **Dedicated Photo CDN Storage ($0)**:
- If you want profile pictures stored outside Postgres in Vercel's CDN, create a **Vercel Blob** store (Hobby Free Tier: 1 GB) under **Storage** and attach `BLOB_READ_WRITE_TOKEN`.
- If you leave `BLOB_READ_WRITE_TOKEN` unset, ParenTech **automatically saves validated ≤ 2 MB profile pictures inside Postgres** at **$0 cost**!

## Step 5: Redeploy & Verify
1. Go to **Deployments → Redeploy**.
2. Visit your live `https://<your-app>.vercel.app` URL:
   - Sign up an account, upload a profile photo, and create tasks/groceries/pills.
   - Log into the exact same account from your phone — your profile, picture, tasks, groceries, and pills sync automatically!
