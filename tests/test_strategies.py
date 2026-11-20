import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
svc_path = str(ROOT_DIR / "services" / "assignment-service")

# Clean import of assignment-service
for k in list(sys.modules.keys()):
    if k == "app" or k.startswith("app."):
        del sys.modules[k]
if svc_path in sys.path:
    sys.path.remove(svc_path)
sys.path.insert(0, svc_path)
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.strategies import (
    RatingRankingStrategy,
    CostRankingStrategy,
    DistanceRankingStrategy,
    get_ranking_strategy,
)

SAMPLE_PROVIDERS = [
    {
        "id": "tech-1",
        "name": "High Rating High Cost",
        "rating": 4.9,
        "total_jobs": 150,
        "hourly_rate": 110.0,
        "service_zip_codes": ["75001", "75002"],
    },
    {
        "id": "tech-2",
        "name": "Mid Rating Low Cost",
        "rating": 4.2,
        "total_jobs": 50,
        "hourly_rate": 45.0,
        "service_zip_codes": ["75001"],
    },
    {
        "id": "tech-3",
        "name": "High Rating Mid Cost Exact Match",
        "rating": 4.8,
        "total_jobs": 200,
        "hourly_rate": 75.0,
        "service_zip_codes": ["75001", "75003"],
    },
    {
        "id": "tech-4",
        "name": "No Rate Specified",
        "rating": 3.8,
        "total_jobs": 10,
        "hourly_rate": None,
        "service_zip_codes": ["75999"],
    },
]


def test_rating_ranking_strategy():
    strategy = RatingRankingStrategy()
    ranked = strategy.rank(SAMPLE_PROVIDERS, context={})

    # Tech 1 (4.9) -> Tech 3 (4.8) -> Tech 2 (4.2) -> Tech 4 (3.8)
    assert ranked[0]["id"] == "tech-1"
    assert ranked[1]["id"] == "tech-3"
    assert ranked[2]["id"] == "tech-2"
    assert ranked[3]["id"] == "tech-4"


def test_cost_ranking_strategy():
    strategy = CostRankingStrategy()
    ranked = strategy.rank(SAMPLE_PROVIDERS, context={})

    # Cheapest first: tech-2 ($45) -> tech-3 ($75) -> tech-1 ($110) -> tech-4 (None)
    assert ranked[0]["id"] == "tech-2"
    assert ranked[1]["id"] == "tech-3"
    assert ranked[2]["id"] == "tech-1"
    assert ranked[3]["id"] == "tech-4"


def test_distance_ranking_strategy():
    strategy = DistanceRankingStrategy()
    # Target zip is 75003
    ranked = strategy.rank(SAMPLE_PROVIDERS, context={"zip_code": "75003"})

    # tech-3 has exact zip 75003 -> score 3
    assert ranked[0]["id"] == "tech-3"
    # tech-4 has 75999 (farther)
    assert ranked[-1]["id"] == "tech-4"


def test_strategy_factory():
    assert isinstance(get_ranking_strategy("rating"), RatingRankingStrategy)
    assert isinstance(get_ranking_strategy("cost"), CostRankingStrategy)
    assert isinstance(get_ranking_strategy("distance"), DistanceRankingStrategy)
    # Default fallback
    assert isinstance(get_ranking_strategy("unknown_strategy"), RatingRankingStrategy)
