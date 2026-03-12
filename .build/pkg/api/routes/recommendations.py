# =============================================================
# api/routes/recommendations.py
# GET /recommendations  — trigger or fetch latest recommendations
# =============================================================

import boto3
import json
import os
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/")
def get_recommendations():
    """
    Invoke the Reasoning Agent Lambda and return structured recommendations.
    For MVP this is synchronous (RequestResponse). Switch to async + polling for v2.
    """
    client = boto3.client("lambda", region_name=os.environ["AWS_REGION_NAME"])
    try:
        response = client.invoke(
            FunctionName=os.environ["REASONING_LAMBDA_NAME"],
            InvocationType="RequestResponse",
            Payload=json.dumps({"trigger": "api"}),
        )
        payload = json.loads(response["Payload"].read())
        if response.get("FunctionError"):
            raise HTTPException(status_code=500, detail=payload)
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
