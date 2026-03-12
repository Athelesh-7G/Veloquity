import sys
from unittest.mock import MagicMock

sys.modules.setdefault("boto3", MagicMock())
sys.modules.setdefault("psycopg2", MagicMock())
