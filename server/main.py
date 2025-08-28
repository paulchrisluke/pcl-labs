import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.api import app

# For Vercel serverless deployment
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
