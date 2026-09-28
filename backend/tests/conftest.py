import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["JWT_SECRET"] = "test-secret-only-not-a-deployment-secret-123"
os.environ["DATABASE_URL"] = "postgresql://test:test@localhost/test"
os.environ["NODE_ENV"] = "development"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
