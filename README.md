## Setup

### 1. Start Redis

**Docker (recommended):**
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Or install Redis for Windows:**
- WSL2: `wsl -e sudo apt install redis-server && wsl -e redis-server`
- Download: https://github.com/tporadowski/redis/releases

### 2. Configure backend

```bash
cd backend
python generate_env.py
```

### 3. Initialize database

```bash
uv run db_init.py
```

## To run backend

```bash
cd backend
uv run fastapi dev
```

## Redis commands (if needed)

```bash
# Check if Redis is running
docker ps

# Stop Redis
docker stop redis

# Start Redis
docker start redis

# Remove Redis container
docker rm -f redis
```

## To generate env
uv run backend/generate_env.py
