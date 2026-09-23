# CSE Study Hub 3.0

Node.js + Express + Supabase Storage version.

## Render environment variables

Set these in Render → Environment:

- `ADMIN_PASSWORD` — your admin password
- `SUPABASE_URL` — Supabase Project URL
- `SUPABASE_SECRET_KEY` — Supabase Secret Key (`sb_secret_...`)
- `SUPABASE_BUCKET` — optional; defaults to `cse-study-hub`

Never commit secret keys to GitHub.

## Storage

Uploaded files are stored in the Supabase Storage bucket instead of Render's local filesystem. The public bucket is used so classmates can download files without logging in.

## Run

```bash
npm install
npm start
```
