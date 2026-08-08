# Haulr — Local Goods Delivery

A polished, responsive prototype for a Porter-style local load delivery service.

## Run with Python

```bash
python3 -m pip install -r requirements.txt
python3 server.py
```

Then open `http://127.0.0.1:5000`.

## Production deployment

This repository includes `render.yaml` for a Render web-service deployment.
Set `HAULR_SECRET_KEY`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in the
Render dashboard as protected environment variables. Never commit `.env` or
production credentials to GitHub.

## Included

- Three-step customer booking flow
- Vehicle selection and fare estimate
- Live order tracking screen
- Driver dashboard with booking accept/reject interactions
- Flask JSON API and SQLite booking persistence
- Real OpenStreetMap booking and live-tracking maps
- CSS and JavaScript motion with reduced-motion accessibility
- Responsive layouts for desktop and mobile

The application includes a working local backend. Production authentication, payment processing, WebSocket tracking, document verification, and cloud deployment still require service credentials and production infrastructure.
