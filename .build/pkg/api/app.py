# =============================================================
# api/app.py
# FastAPI application entry point.
# =============================================================

from fastapi import FastAPI
from api.routes import evidence, recommendations, constraints

app = FastAPI(
    title="Veloquity API",
    description="Evidence Intelligence API for Veloquity MVP",
    version="0.1.0",
)

app.include_router(evidence.router,        prefix="/evidence",        tags=["Evidence"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["Recommendations"])
app.include_router(constraints.router,     prefix="/constraints",     tags=["Constraints"])

@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "veloquity-api"}
