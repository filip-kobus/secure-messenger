# Docker Setup Guide

## Prerequisites

- Docker Desktop installed
- Docker Compose installed

## Initial Setup

### 1. Generate SSL Certificates

```bash
cd nginx
bash generate-ssl.sh
```

Or on Windows (PowerShell):

```powershell
cd nginx
New-Item -ItemType Directory -Force -Path ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout ssl/key.pem `
    -out ssl/cert.pem `
    -subj "/C=PL/ST=State/L=City/O=Organization/CN=localhost"
```

### 2. Generate Backend Environment

```bash
cd backend
python generate_env.py
```

### 3. Initialize Database

```bash
cd backend
uv run db_init.py
```

## Running with Docker

### Start all services

```bash
docker-compose up -d
```

### View logs

```bash
docker-compose logs -f
```

### Stop all services

```bash
docker-compose down
```

### Rebuild and restart

```bash
docker-compose up -d --build
```

## Service URLs

- **Frontend (HTTPS)**: https://localhost
- **Backend API (HTTPS)**: https://localhost/api
- **Frontend (Direct)**: http://localhost:4200
- **Backend (Direct)**: http://localhost:8000
- **Redis**: localhost:6379

## Troubleshooting

### Check service status

```bash
docker-compose ps
```

### View specific service logs

```bash
docker-compose logs backend
docker-compose logs frontend
docker-compose logs nginx
docker-compose logs redis
```

### Restart specific service

```bash
docker-compose restart backend
```

### Clean up everything

```bash
docker-compose down -v
docker system prune -a
```

### Database issues

If you need to reset the database:

```bash
docker-compose down
rm backend/db.sqlite3
cd backend && uv run db_init.py
docker-compose up -d
```

## Development vs Production

### Development (without Docker)

```bash
# Terminal 1 - Redis
docker run -d --name redis -p 6379:6379 redis:alpine

# Terminal 2 - Backend
cd backend
uv run fastapi dev

# Terminal 3 - Frontend
cd frontend
npm start
```

### Production (with Docker)

```bash
docker-compose up -d
```

Access via https://localhost

## Security Notes

- The generated SSL certificates are self-signed for development
- For production, use proper SSL certificates (Let's Encrypt, etc.)
- Update Content-Security-Policy in nginx.conf for your domain
- Change default ports if needed
- Use environment-specific .env files
