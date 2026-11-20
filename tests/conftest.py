import os
import sys
from pathlib import Path
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

ROOT_DIR = Path(__file__).resolve().parent.parent

# Shared library must always be in sys.path
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def switch_service_context(service_dir_name: str):
    """
    Safely switches the active service context for test execution,
    clearing previously cached 'app.*' modules from sys.modules.
    """
    svc_path = str(ROOT_DIR / "services" / service_dir_name)
    for k in list(sys.modules.keys()):
        if k == "app" or k.startswith("app."):
            del sys.modules[k]
    if svc_path in sys.path:
        sys.path.remove(svc_path)
    sys.path.insert(0, svc_path)
    return svc_path
