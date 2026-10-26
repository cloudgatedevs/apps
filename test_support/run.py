"""Run Python tests with the repository's SQL Server integration support."""
import os,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
environment=dict(os.environ,PYTHONPATH=str(ROOT/'test_support'),PYTHONUTF8='1')
raise SystemExit(subprocess.call([sys.executable,'-X','utf8','-B',*sys.argv[1:]],env=environment))
