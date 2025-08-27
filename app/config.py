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

# Vision settings (Raspberry Pi friendly)
VISION_CACHE_DIR = DATA_DIR / ".cache"
VISION_MAX_WIDTH = 640           # resize width for feature extraction
VISION_ORB_FEATURES = 800        # nfeatures for ORB
VISION_RATIO_TEST = 0.75         # Lowe's ratio test threshold
VISION_MIN_GOOD_MATCHES = 20     # minimal good matches per class
VISION_SCORE_THRESHOLD = 0.25    # minimal good/total ratio to accept
