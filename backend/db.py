import psycopg2
from psycopg2.extras import RealDictCursor

from config import Config

def get_db():
    if Config.DATABASE_URL:
        return psycopg2.connect(
    Config.DATABASE_URL,
    sslmode="require"
)
    return psycopg2.connect(
        host=Config.DB_HOST,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        dbname=Config.DB_NAME,
        port=Config.DB_PORT
    )


def get_dict_cursor(db):
    return db.cursor(cursor_factory=RealDictCursor)
