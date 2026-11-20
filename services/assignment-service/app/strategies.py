from abc import ABC, abstractmethod
from typing import List, Dict, Any


class ProviderRankingStrategy(ABC):
    @abstractmethod
    def rank(self, providers: List[Dict[str, Any]], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Rank a list of provider dicts based on context and return ranked list."""
        pass


class RatingRankingStrategy(ProviderRankingStrategy):
    """Ranks providers by customer rating descending, then total completed jobs."""

    def rank(self, providers: List[Dict[str, Any]], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        return sorted(
            providers,
            key=lambda p: (
                p.get("rating", 0.0),
                p.get("total_jobs", 0),
            ),
            reverse=True,
        )


class CostRankingStrategy(ProviderRankingStrategy):
    """Ranks providers by hourly rate ascending (lowest cost first)."""

    def rank(self, providers: List[Dict[str, Any]], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        # None rates go last, otherwise lowest rate first
        return sorted(
            providers,
            key=lambda p: (
                p.get("hourly_rate") is None,
                p.get("hourly_rate", float("inf")),
            ),
        )


class DistanceRankingStrategy(ProviderRankingStrategy):
    """
    Ranks providers by distance/proximity to the target work order zip code.
    Simulated using zip code prefix overlap: exact zip matches rank highest (score 3),
    first 3 digits match rank next (score 2), state/first 2 digits match rank score 1.
    """

    def rank(self, providers: List[Dict[str, Any]], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        target_zip = str(context.get("zip_code", "")).strip()

        def proximity_score(p: Dict[str, Any]) -> int:
            service_zips = [str(z).strip() for z in p.get("service_zip_codes", [])]
            if "*" in service_zips:
                return 1
            if target_zip in service_zips:
                return 3
            if any(z[:3] == target_zip[:3] for z in service_zips if len(z) >= 3 and len(target_zip) >= 3):
                return 2
            if any(z[:2] == target_zip[:2] for z in service_zips if len(z) >= 2 and len(target_zip) >= 2):
                return 1
            return 0

        return sorted(providers, key=proximity_score, reverse=True)


STRATEGY_REGISTRY: Dict[str, ProviderRankingStrategy] = {
    "rating": RatingRankingStrategy(),
    "cost": CostRankingStrategy(),
    "distance": DistanceRankingStrategy(),
}


def get_ranking_strategy(strategy_name: str) -> ProviderRankingStrategy:
    key = (strategy_name or "rating").lower().strip()
    return STRATEGY_REGISTRY.get(key, STRATEGY_REGISTRY["rating"])
