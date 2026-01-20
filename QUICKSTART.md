# Quick Start

## Option 1: Docker (Recommended for Production)

1. Generate SSL certificates:
```bash
cd nginx
bash generate-ssl.sh  # or use PowerShell on Windows (see DOCKER.md)
```

2. Generate backend .env:
```bash
cd backend
python generate_env.py
```

3. Initialize database:
```bash
cd backend
uv run db_init.py
```

4. Start all services:
```bash
docker-compose up -d
```

5. Access: **https://localhost**

For detailed Docker instructions, see [DOCKER.md](DOCKER.md)

## Option 2: Development (Local)

See main [README.md](README.md) for local development setup.
