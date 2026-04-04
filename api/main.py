# =============================================================
# api/main.py
# FastAPI application entry point for Veloquity API v1.
# =============================================================

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import agents, chat, constraints, evidence, governance, recommendations, upload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Veloquity API",
    description="Agentic Evidence Intelligence — FastAPI backend",
    version="1.0.0",
)

# CORS
frontend_url = os.environ.get("FRONTEND_URL", "*")
origins = [frontend_url] if frontend_url != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
_PREFIX = "/api/v1"
app.include_router(evidence.router,        prefix=f"{_PREFIX}/evidence",        tags=["Evidence"])
app.include_router(recommendations.router, prefix=f"{_PREFIX}/recommendations",  tags=["Recommendations"])
app.include_router(agents.router,          prefix=f"{_PREFIX}/agents",           tags=["Agents"])
app.include_router(governance.router,      prefix=f"{_PREFIX}/governance",       tags=["Governance"])
app.include_router(chat.router,            prefix=f"{_PREFIX}/chat",             tags=["Chat"])
app.include_router(constraints.router,     prefix=f"{_PREFIX}/constraints",      tags=["Constraints"])
app.include_router(upload.router,          prefix=f"{_PREFIX}/upload",            tags=["Upload"])


@app.get("/health", tags=["Health"])
def health():
    """Instant health check — no DB calls, used for Render cold-start wake-up."""
    return {"status": "ok", "service": "veloquity-api"}


@app.get("/", tags=["Health"])
def root():
    """Root endpoint."""
    return {"service": "veloquity-api", "status": "running"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "path": str(request.url)},
    )


# Uvicorn entry point for Render
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=False)
