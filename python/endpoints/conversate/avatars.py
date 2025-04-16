import os

from fastapi import APIRouter, UploadFile, File, Form

router = APIRouter()

AVATARS_DIR = "avatars"

@router.post("/upload-cropped-avatar")
async def upload_cropped_avatar(speaker_id: str = Form(...), file: UploadFile = File(...)):
    """
    Save the cropped avatar image for a speaker.
    The image is saved with a filename based on the speaker_id.
    """
    filename = f"cropped_{speaker_id}.png"
    file_path = os.path.join(AVATARS_DIR, filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    # Return the relative URL of the cropped image.
    return {"filename": filename, "url": f"avatars/{filename}"}