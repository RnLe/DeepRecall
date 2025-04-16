import os

from fastapi import UploadFile, File, Form, HTTPException, APIRouter
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

from helpers.dataPersistenceHelpers import save_speakers, load_speakers, load_conversations, save_conversations
from helpers.parsingHelpers import sanitize_filename

AVATARS_DIR = "avatars"

router = APIRouter()

@router.post("/speakers")
async def add_speaker(
    id: str = Form(...),
    name: str = Form(...),
    color: str = Form(...),
    presetAvatar: str = Form(default=""),
    image: UploadFile = File(None),
    croppedArea: str = Form(default="")  # Expected format: "width,height,x,y"
):
    """
    Add a new speaker. If presetAvatar is provided, the image upload and cropping are ignored.
    """
    speakers = load_speakers()

    if presetAvatar:
        new_speaker = {
            "id": id,
            "name": name,
            "color": color,
            "presetAvatar": presetAvatar,
            "originalImageUrl": None,
            "croppedImageUrl": None
        }
        speakers.append(new_speaker)
        save_speakers(speakers)
        return {"message": "Speaker added successfully.", "speakers": speakers}

    original_image_path = None
    cropped_image_path = None

    if image:
        sanitized = sanitize_filename(name)
        original_filename = f"{sanitized}_{id}_original.png"
        cropped_filename = f"{sanitized}_{id}_cropped.png"

        original_image_path = os.path.join(AVATARS_DIR, original_filename)
        cropped_image_path = os.path.join(AVATARS_DIR, cropped_filename)

        # Save the original image
        with open(original_image_path, "wb") as f:
            content = await image.read()
            f.write(content)

        # Open the original image for cropping
        with Image.open(original_image_path) as img:
            width, height = img.size
            if croppedArea:
                parts = croppedArea.split(",")
                if len(parts) != 4:
                    raise HTTPException(status_code=400, detail="Invalid croppedArea format; expected 4 comma-separated numbers.")
                try:
                    crop_width, crop_height, crop_x, crop_y = map(float, parts)
                except Exception:
                    raise HTTPException(status_code=400, detail="Invalid croppedArea values; expected numbers.")
                left = crop_x
                top = crop_y
                right = crop_x + crop_width
                bottom = crop_y + crop_height
            else:
                min_dim = min(width, height)
                left = (width - min_dim) / 2
                top = (height - min_dim) / 2
                right = (width + min_dim) / 2
                bottom = (height + min_dim) / 2

            cropped_img = img.crop((left, top, right, bottom))
            cropped_img = cropped_img.resize((256, 256))
            cropped_img.save(cropped_image_path)

    new_speaker = {
        "id": id,
        "name": name,
        "color": color,
        "presetAvatar": "",  # no preset when image is uploaded
        "originalImageUrl": original_image_path,
        "croppedImageUrl": cropped_image_path
    }
    speakers.append(new_speaker)
    save_speakers(speakers)
    return {"message": "Speaker added successfully.", "speakers": speakers}

@router.get("/speakers")
async def get_speakers():
    """
    Get the list of speakers.
    """
    speakers = load_speakers()
    return {"speakers": speakers}

@router.get("/speakers/{speaker_id}")
async def get_speaker(speaker_id: str):
    speakers = load_speakers()
    speaker = next((s for s in speakers if s["id"] == speaker_id), None)
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found.")
    return {"speaker": speaker}

@router.put("/speakers/{speaker_id}")
async def update_speaker(
    speaker_id: str,
    name: str = Form(...),
    color: str = Form(...),
    presetAvatar: str = Form(default=""),
    image: UploadFile = File(None),
    croppedArea: str = Form(default="")  # Expected format: "width,height,x,y"
):
    speakers = load_speakers()
    speaker = next((s for s in speakers if s["id"] == speaker_id), None)
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found.")

    new_sanitized = sanitize_filename(name)
    original_image_path = speaker.get("originalImageUrl")
    cropped_image_path = speaker.get("croppedImageUrl")

    if presetAvatar:
        # If a preset is chosen, ignore image updates.
        speaker["presetAvatar"] = presetAvatar
        speaker["originalImageUrl"] = None
        speaker["croppedImageUrl"] = None
    else:
        # Clear any existing preset
        speaker["presetAvatar"] = ""
        if image:
            original_filename = f"{new_sanitized}_{speaker_id}_original.png"
            cropped_filename = f"{new_sanitized}_{speaker_id}_cropped.png"
            original_image_path = os.path.join(AVATARS_DIR, original_filename)
            cropped_image_path = os.path.join(AVATARS_DIR, cropped_filename)
            with open(original_image_path, "wb") as f:
                content = await image.read()
                f.write(content)
            with Image.open(original_image_path) as img:
                width, height = img.size
                if croppedArea:
                    parts = croppedArea.split(",")
                    if len(parts) != 4:
                        raise HTTPException(status_code=400, detail="Invalid croppedArea format; expected 4 comma-separated numbers.")
                    try:
                        crop_width, crop_height, crop_x, crop_y = map(float, parts)
                    except Exception:
                        raise HTTPException(status_code=400, detail="Invalid croppedArea values; expected numbers.")
                    left = crop_x
                    top = crop_y
                    right = crop_x + crop_width
                    bottom = crop_y + crop_height
                else:
                    min_dim = min(width, height)
                    left = (width - min_dim) / 2
                    top = (height - min_dim) / 2
                    right = (width + min_dim) / 2
                    bottom = (height + min_dim) / 2
                cropped_img = img.crop((left, top, right, bottom))
                cropped_img = cropped_img.resize((256, 256))
                cropped_img.save(cropped_image_path)
        else:
            if croppedArea and original_image_path and os.path.exists(original_image_path):
                with Image.open(original_image_path) as img:
                    width, height = img.size
                    parts = croppedArea.split(",")
                    if len(parts) != 4:
                        raise HTTPException(status_code=400, detail="Invalid croppedArea format; expected 4 comma-separated numbers.")
                    try:
                        crop_width, crop_height, crop_x, crop_y = map(float, parts)
                    except Exception:
                        raise HTTPException(status_code=400, detail="Invalid croppedArea values; expected numbers.")
                    left = crop_x
                    top = crop_y
                    right = crop_x + crop_width
                    bottom = crop_y + crop_height
                    cropped_img = img.crop((left, top, right, bottom))
                    cropped_img = cropped_img.resize((256, 256))
                    new_cropped_path = os.path.join(AVATARS_DIR, f"{new_sanitized}_{speaker_id}_cropped.png")
                    cropped_img.save(new_cropped_path)
                    cropped_image_path = new_cropped_path
            if original_image_path:
                new_original_path = os.path.join(AVATARS_DIR, f"{new_sanitized}_{speaker_id}_original.png")
                if os.path.exists(original_image_path) and original_image_path != new_original_path:
                    os.rename(original_image_path, new_original_path)
                    original_image_path = new_original_path
            if cropped_image_path:
                new_cropped_path = os.path.join(AVATARS_DIR, f"{new_sanitized}_{speaker_id}_cropped.png")
                if os.path.exists(cropped_image_path) and cropped_image_path != new_cropped_path:
                    os.rename(cropped_image_path, new_cropped_path)
                    cropped_image_path = new_cropped_path

        speaker["originalImageUrl"] = original_image_path
        speaker["croppedImageUrl"] = cropped_image_path

    speaker["name"] = name
    speaker["color"] = color
    save_speakers(speakers)
    return {"message": "Speaker updated successfully.", "speaker": speaker}

@router.delete("/speakers/{speaker_id}")
async def delete_speaker(speaker_id: str):
    speakers = load_speakers()
    speaker = next((s for s in speakers if s["id"] == speaker_id), None)
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found.")
    speakers = [s for s in speakers if s["id"] != speaker_id]
    save_speakers(speakers)
    # Optionally remove speaker image
    if speaker.get("originalImageUrl") and os.path.exists(speaker["originalImageUrl"]):
        os.remove(speaker["originalImageUrl"])
    if speaker.get("croppedImageUrl") and os.path.exists(speaker["croppedImageUrl"]):
        os.remove(speaker["croppedImageUrl"])
    return {"message": "Speaker deleted successfully.", "speakers": speakers}

@router.put("/conversation/{conv_id}/assign-speakers")
async def assign_speakers(conv_id: str, speakers: str = Form(...)):
    """
    Update the speaker assignment for a conversation.
    Expects a comma-separated list of speaker IDs (order sensitive).
    The updated list is saved into the conversation record and the state is set accordingly.
    """
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    # Parse the provided speakers list.
    speakers_list = [s.strip() for s in speakers.split(",") if s.strip()]
    conversation["speakers"] = speakers_list
    conversation["states"]["speakerAssignment"] = bool(speakers_list)
    save_conversations(conversations)
    return {"message": "Speaker assignment updated.", "speakers": speakers_list}