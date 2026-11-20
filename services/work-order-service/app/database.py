import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DEFAULT_PG = "postgresql+psycopg2://dizpatch:dizpatch_pass@localhost:5432/dizpatch_work_orders"
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    try:
        import psycopg2
        DATABASE_URL = DEFAULT_PG
    except ImportError:
        try:
            import pymysql
            DATABASE_URL = "mysql+pymysql://dizpatch:dizpatch_pass@localhost/dizpatch_work_orders"
        except ImportError:
            DATABASE_URL = "sqlite:///./work_orders.db"

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
