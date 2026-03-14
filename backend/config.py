import os
from pathlib import Path
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None


def _load_local_env():
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


if load_dotenv is not None:
    load_dotenv()
else:
    _load_local_env()


def _database_settings():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        parsed = urlparse(database_url)
        return {
            "host": parsed.hostname or "localhost",
            "user": parsed.username or "",
            "password": parsed.password or "",
            "name": (parsed.path or "").lstrip("/") or "",
            "port": str(parsed.port or 5432),
        }

    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", ""),
        "name": os.getenv("DB_NAME", "profitdb"),
        "port": os.getenv("DB_PORT", "5432"),
    }


_DB_SETTINGS = _database_settings()


class Config:
    DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
    DB_HOST = _DB_SETTINGS["host"]
    DB_USER = _DB_SETTINGS["user"]
    DB_PASSWORD = _DB_SETTINGS["password"]
    DB_NAME = _DB_SETTINGS["name"]
    DB_PORT = _DB_SETTINGS["port"]
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key")


DB_HOST = Config.DB_HOST
DB_USER = Config.DB_USER
DB_PASSWORD = Config.DB_PASSWORD
DB_NAME = Config.DB_NAME
DB_PORT = Config.DB_PORT
