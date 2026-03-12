# =============================================================
# api/routes/constraints.py
# GET  /constraints     — read current constraint config
# POST /constraints     — update constraint config (PM updates)
# =============================================================

import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

router = APIRouter()

CONSTRAINTS_PATH = os.path.join(
    os.path.dirname(__file__), "../../reasoning/constraints.json"
)

class ConstraintsUpdate(BaseModel):
    engineering_capacity: str          # "low" | "medium" | "high"
    current_sprint_load: str           # "low" | "medium" | "high"
    business_priorities: List[str]     # e.g. ["retention", "onboarding"]
    risk_flags: List[str]              # e.g. ["no breaking API changes"]

@router.get("/")
def get_constraints():
    """Return the current active constraint configuration."""
    try:
        with open(CONSTRAINTS_PATH) as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="constraints.json not found")

@router.post("/")
def update_constraints(body: ConstraintsUpdate):
    """
    Update the constraint config.
    PM calls this when capacity or priorities change.
    Takes effect on the next Reasoning Agent invocation.
    """
    data = body.dict()
    with open(CONSTRAINTS_PATH, "w") as f:
        json.dump(data, f, indent=2)
    return {"updated": True, "constraints": data}
