# Deploy NSR Calculator on Railway

This guide walks you through deploying the NSR Calculator on Railway's free tier.

## Prerequisites

- GitHub account with the project pushed
- Railway account ([railway.app](https://railway.app))

## Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your repository
5. Select the `minas` repository

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will provision a PostgreSQL instance automatically
4. Note: The `DATABASE_URL` variable is auto-configured

## Step 3: Deploy Backend

1. Click **"+ New"** → **"GitHub Repo"** → Select `minas` again
2. In the service settings:
   - **Root Directory:** `backend`
   - **Name:** `nsr-backend`
3. Go to **Variables** tab and add:

| Variable | Value |
|----------|-------|
| `SECRET_KEY` | (generate a random 32+ character string) |
| `CORS_ORIGINS` | `["https://YOUR_FRONTEND_URL.railway.app"]` |
| `DATABASE_URL` | (click "Add Reference" → select PostgreSQL) |

4. Click **"Deploy"**

## Step 4: Deploy Frontend

1. Click **"+ New"** → **"GitHub Repo"** → Select `minas` again
2. In the service settings:
   - **Root Directory:** `frontend`
   - **Name:** `nsr-frontend`
3. Go to **Variables** tab and add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://nsr-backend-YOUR_PROJECT.railway.app` |

4. Click **"Deploy"**

## Step 5: Get Your URLs

After deployment:

1. Click on each service
2. Go to **Settings** → **Networking**
3. Click **"Generate Domain"** for both backend and frontend
4. Update the environment variables with the actual URLs:
   - Update `CORS_ORIGINS` in backend with frontend URL
   - Update `NEXT_PUBLIC_API_URL` in frontend with backend URL

## Step 6: Configure Google OAuth (Optional)

If you want Google login:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://nsr-backend-xxx.railway.app/auth/callback/google`
4. Add these variables to the backend service:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Your Google Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google Client Secret |
| `GOOGLE_REDIRECT_URI` | `https://nsr-backend-xxx.railway.app/auth/callback/google` |

## Environment Variables Reference

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto from Railway) |
| `SECRET_KEY` | Yes | JWT signing key (random string) |
| `CORS_ORIGINS` | Yes | JSON array of allowed origins |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | No | OAuth callback URL |
| `INITIAL_ADMIN_EMAIL` | No | Email to auto-promote to admin |
| `METAL_PRICE_API_KEY` | No | API key for live metal prices |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |

## Troubleshooting

### Build fails
- Check Railway build logs for errors
- Ensure root directory is set correctly (`backend` or `frontend`)

### Database connection fails
- Verify `DATABASE_URL` is linked to PostgreSQL service
- Check that PostgreSQL service is running

### CORS errors
- Ensure `CORS_ORIGINS` includes the exact frontend URL with `https://`
- Redeploy backend after changing CORS settings

### Frontend can't reach backend
- Verify `NEXT_PUBLIC_API_URL` is correct
- Note: This variable is baked in at build time, so redeploy after changing

## Free Tier Limits

Railway's free tier includes:
- $5 of usage credits per month
- ~500 hours of compute time
- 1GB RAM per service
- PostgreSQL included

This is sufficient for demo/testing purposes.

## Generate a Secure SECRET_KEY

Run this in your terminal to generate a secure key:

```bash
openssl rand -hex 32
```

Or use Python:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
