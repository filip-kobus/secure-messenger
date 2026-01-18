import redis.asyncio as redis
from app.config import JWTConfig


async def add_refresh_token(redis_conn: redis.Redis, user_id: int, refresh_token_id: str):
    ttl_seconds = JWTConfig.REFRESH_EXPIRE_DAYS * 24 * 60 * 60
    
    await redis_conn.setex(
        f"refresh_token:{refresh_token_id}",
        ttl_seconds,
        str(user_id)
    )
    
    await redis_conn.sadd(f"user:{user_id}:refresh_tokens", refresh_token_id)
    await redis_conn.expire(f"user:{user_id}:refresh_tokens", ttl_seconds)


async def check_refresh_token(redis_conn: redis.Redis, refresh_token_id: str) -> str | None:
    print(f"[DEBUG check_refresh_token] Looking for token: {refresh_token_id}")
    
    user_id = await redis_conn.get(f"refresh_token:{refresh_token_id}")
    
    print(f"[DEBUG check_refresh_token] Found token: {user_id is not None}")
    return user_id


async def revoke_refresh_token(redis_conn: redis.Redis, refresh_token_id: str):
    user_id = await redis_conn.get(f"refresh_token:{refresh_token_id}")
    
    await redis_conn.delete(f"refresh_token:{refresh_token_id}")
    
    if user_id:
        await redis_conn.srem(f"user:{user_id}:refresh_tokens", refresh_token_id)


async def revoke_all_user_tokens(redis_conn: redis.Redis, user_id: int):
    token_ids = await redis_conn.smembers(f"user:{user_id}:refresh_tokens")
    
    if token_ids:
        keys_to_delete = [f"refresh_token:{token_id}" for token_id in token_ids]
        await redis_conn.delete(*keys_to_delete)
    
    await redis_conn.delete(f"user:{user_id}:refresh_tokens")
