import logging
from app.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
from supabase import create_client, Client
from typing import Optional

logger = logging.getLogger(__name__)

supabase_client: Optional[Client] = None
supabase_admin: Optional[Client] = None
supabase_scoped: Optional[Client] = None

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        supabase_client = supabase_admin
        logger.info("Connected to Supabase Admin Client.")
    except Exception as e:
        logger.warning(f"Supabase admin init warning: {e}")

if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        supabase_scoped = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    except Exception as e:
        logger.warning(f"Supabase scoped init warning: {e}")

