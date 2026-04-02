# GMGN Backend

Small Node/Express backend for SolCheck.

## Local run

1. Copy `.env.example` to `.env`
2. Set `GMGN_API_KEY`
3. Run:

```bash
npm install
npm start
```

## Endpoints

- `GET /health`
- `GET /gmgn/token/:mint`
- `GET /gmgn/kols/:mint`
