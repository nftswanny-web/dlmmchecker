# GMGN Backend Deploy

Use this setup if GMGN is blocked behind Cloudflare on Vercel.

## Architecture

- Frontend: Vercel
- GMGN backend: Railway

## Railway

1. Push the repo to GitHub
2. Create a new Railway project from GitHub
3. Select this repository
4. Set the Railway root directory to `backend`
5. Add these environment variables:
   - `GMGN_API_KEY=your_real_key`
   - `PORT=3001`
   - `CORS_ORIGIN=https://your-site.vercel.app`
6. Deploy
7. Copy the Railway public URL

## Vercel frontend

1. Deploy the site as usual on Vercel
2. Open the site
3. In the `GMGN API` field, paste the Railway URL
4. Run the token analysis

## Backend endpoints

- `GET /health`
- `GET /gmgn/token/:mint`
- `GET /gmgn/kols/:mint`

## Notes

- The GMGN key now belongs only on the backend
- If Railway is also blocked by Cloudflare, you will need a GMGN-approved server/IP
