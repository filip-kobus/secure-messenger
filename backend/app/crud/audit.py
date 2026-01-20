from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.audit import HoneypotEvent, LoginEvent
from app.models.user import User

async def create_honeypot_event(db: AsyncSession, ip_address: str, user_agent: str, endpoint: str):
    honeypot_event = HoneypotEvent(
        ip_address=ip_address,
        user_agent=user_agent,
        endpoint=endpoint
    )
    db.add(honeypot_event)
    await db.commit()
    await db.refresh(honeypot_event)
    return honeypot_event

async def log_login_event(
    db: AsyncSession,
    user_id: int,
    ip_address: str,
    user_agent: str
) -> LoginEvent:
    history_query = select(LoginEvent).where(LoginEvent.user_id == user_id).limit(1)
    history_result = await db.execute(history_query)
    has_history = history_result.scalars().first() is not None

    query = select(LoginEvent).where(
        LoginEvent.user_id == user_id,
        LoginEvent.user_agent == user_agent,
        LoginEvent.ip_address == ip_address
    )
    result = await db.execute(query)
    existing_device = result.scalars().first()
    
    is_new_device = (existing_device is None) and has_history
    
    login_event = LoginEvent(
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        is_new_device=is_new_device,
    )
    db.add(login_event)
    await db.commit()
    await db.refresh(login_event)
    return login_event
