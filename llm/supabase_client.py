import os
from supabase import create_client, Client

_client: "Client | None" = None


def get_supabase() -> "Client":
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = (
            os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        )
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant dans .env"
            )
        _client = create_client(url, key)
    return _client
