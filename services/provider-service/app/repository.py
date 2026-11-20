import json
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import Provider, ProviderStatus


class ProviderRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, provider_id: str) -> Optional[Provider]:
        return self.db.query(Provider).filter(Provider.id == provider_id).first()

    def get_by_email(self, email: str) -> Optional[Provider]:
        return self.db.query(Provider).filter(Provider.email == email).first()

    def list_all(self, limit: int = 100, offset: int = 0) -> List[Provider]:
        return self.db.query(Provider).order_by(Provider.created_at.desc()).offset(offset).limit(limit).all()

    def create(self, provider: Provider) -> Provider:
        self.db.add(provider)
        self.db.flush()
        self.db.refresh(provider)
        return provider

    def update(self, provider: Provider) -> Provider:
        self.db.add(provider)
        self.db.flush()
        self.db.refresh(provider)
        return provider

    def find_matching_providers(self, zip_code: str, required_skills: List[str]) -> List[Provider]:
        available = self.db.query(Provider).filter(Provider.status == ProviderStatus.AVAILABLE).all()
        matched = []
        req_skills_lower = {s.lower() for s in required_skills}

        for p in available:
            # Parse json lists
            try:
                p_zips = json.loads(p.service_zip_codes) if isinstance(p.service_zip_codes, str) else p.service_zip_codes
            except Exception:
                p_zips = []

            try:
                p_skills = json.loads(p.skills) if isinstance(p.skills, str) else p.skills
            except Exception:
                p_skills = []

            # Check zip match
            zip_matched = (zip_code in p_zips) or ("*" in p_zips) or (len(p_zips) == 0)

            # Check skills match (at least one skill matches, or if no required skills specified)
            if req_skills_lower:
                p_skills_lower = {s.lower() for s in p_skills}
                skills_matched = bool(req_skills_lower.intersection(p_skills_lower))
            else:
                skills_matched = True

            if zip_matched and skills_matched:
                matched.append(p)

        return matched
