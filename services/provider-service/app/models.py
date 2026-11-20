from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, Enum as SAEnum
from app.database import Base
from datetime import datetime
import enum


class ProviderStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    INACTIVE = "INACTIVE"


class Provider(Base):
    __tablename__ = "providers"
    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    phone = Column(String(20), nullable=True)
    status = Column(SAEnum(ProviderStatus, native_enum=False), nullable=False, default=ProviderStatus.AVAILABLE)
    skills = Column(Text, nullable=False, default="[]")            # JSON array as text
    service_zip_codes = Column(Text, nullable=False, default="[]") # JSON array as text
    hourly_rate = Column(Float, nullable=True)
    rating = Column(Float, nullable=False, default=0.0)
    total_jobs = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
