from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os

router = APIRouter()

@router.get("/files")
async def list_files():
    """
    List generated files with common extensions (e.g. .rttm, .json, .txt).
    """
    allowed_extensions = (".rttm", ".json", ".txt")
    files = [f for f in os.listdir(".") if f.endswith(allowed_extensions)]
    return {"files": files}

@router.get("/files/{filename}")
async def get_file(filename: str):
    """
    Return a file by filename.
    """
    if os.path.exists(filename):
        return FileResponse(filename)
    else:
        raise HTTPException(status_code=404, detail="File not found.")