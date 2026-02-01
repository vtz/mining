"""Permission checking utilities."""

import uuid
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.mine import Mine
from app.models.user_mine import UserMine


async def check_mine_access(
    db: AsyncSession,
    user: User,
    mine_id: uuid.UUID,
    required_roles: Optional[List[str]] = None
) -> bool:
    """
    Check if user has access to a specific mine.
    
    Args:
        db: Database session
        user: User to check
        mine_id: Mine ID to check access for
        required_roles: Optional list of required roles (e.g., ['admin', 'editor'])
        
    Returns:
        True if user has access, False otherwise
    """
    # Admins have access to everything
    if user.is_admin:
        return True
    
    # Check user_mines association
    query = select(UserMine).where(
        UserMine.user_id == user.id,
        UserMine.mine_id == mine_id
    )
    
    result = await db.execute(query)
    user_mine = result.scalar_one_or_none()
    
    if not user_mine:
        return False
    
    # Check role if required
    if required_roles and user_mine.role not in required_roles:
        return False
    
    return True


async def get_accessible_mine_ids(
    db: AsyncSession,
    user: User
) -> List[uuid.UUID]:
    """
    Get list of mine IDs the user has access to.
    
    Args:
        db: Database session
        user: User to get mines for
        
    Returns:
        List of mine UUIDs
    """
    # Admins have access to all mines
    if user.is_admin:
        result = await db.execute(select(Mine.id))
        return [row[0] for row in result.fetchall()]
    
    # Get mines from user_mines
    result = await db.execute(
        select(UserMine.mine_id).where(UserMine.user_id == user.id)
    )
    
    return [row[0] for row in result.fetchall()]


async def get_user_role_for_mine(
    db: AsyncSession,
    user: User,
    mine_id: uuid.UUID
) -> Optional[str]:
    """
    Get user's role for a specific mine.
    
    Args:
        db: Database session
        user: User to check
        mine_id: Mine ID
        
    Returns:
        Role string or None if no access
    """
    if user.is_admin:
        return "admin"
    
    result = await db.execute(
        select(UserMine.role).where(
            UserMine.user_id == user.id,
            UserMine.mine_id == mine_id
        )
    )
    
    row = result.scalar_one_or_none()
    return row
