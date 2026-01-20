from fastapi import APIRouter, Request, Depends
from app.models.audit import HoneypotEvent
from app.db import AsyncSession, get_db
from app.utils.rate_limiter import limiter

router = APIRouter(tags=["honeypot"])

@router.get("/admin")
@router.get("/wp-admin")
@router.get("/.env")
@limiter.limit("1/minute") 
async def honey_pot(request: Request, db: AsyncSession = Depends(get_db)):
    honeypot_event = HoneypotEvent(
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        endpoint=request.url.path
    )
    db.add(honeypot_event)
    await db.commit()
    return {"message": "Access denied"}
