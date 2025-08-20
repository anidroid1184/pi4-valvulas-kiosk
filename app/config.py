import os
from pathlib import Path

# Basic configuration. On Raspberry Pi, adjust paths if needed.
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "valves.db"
IMAGES_DIR = DATA_DIR / "images"

# UI settings
APP_TITLE = "Valve Finder"
WINDOW_SIZE = "1024x600"  # Target display resolution per client hardware
FULLSCREEN = True  # Kiosk mode later

# Performance targets
MAX_IMAGE_SIZE_KB = 500
MAX_VALVES = 80
