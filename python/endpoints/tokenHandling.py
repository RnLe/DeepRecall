from fastapi import APIRouter, HTTPException

from dotenv import load_dotenv  # Load .env file
load_dotenv()  # load environment variables from .env

# Import helper functions
from helpers.dataPersistenceHelpers import (
    load_api_tokens,
    map_env_tokens_to_names,
    save_api_token,
)

router = APIRouter()

@router.get("/apitokens")
async def get_api_tokens():
    """
    Get the list of API tokens.
    Returns tokens with each token masked.
    """
    tokens = load_api_tokens()
    return {"tokens": tokens}

@router.post("/apitokens")
async def post_api_token(tokenData: dict):
    """
    Set an API token.
    Expects a JSON payload with:
      - name: Human-readable token name (e.g. "Hugging Face")
      - token: The API token.
    """
    name = tokenData.get("name")
    token_value = tokenData.get("token")
    if not name or not token_value:
        raise HTTPException(status_code=400, detail="Token name and value must be provided.")
    env_var = map_env_tokens_to_names(name)
    if not env_var:
        raise HTTPException(status_code=400, detail="Unsupported token name.")
    save_api_token(env_var, token_value)
    return {"message": f"{name} token updated.", "tokens": load_api_tokens()}
