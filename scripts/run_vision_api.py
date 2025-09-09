"""
Run the Valve Vision API (FastAPI) with Uvicorn.
Linux/Raspberry Pi friendly runner.

Usage:
  python -m scripts.run_vision_api
  # or
  python scripts/run_vision_api.py
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.vision_api.main:app", host="0.0.0.0", port=8000, reload=False, workers=1)
