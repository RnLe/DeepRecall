# api.py

# ----------------- Imports -----------------
import os
import json
import time
import re
import hashlib
import shutil
from typing import List, Dict

import logging

# Configure the logger at the top level of your application (this might be in your main file)
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import torch
import whisper
from pyannote.audio import Pipeline
from pyannote.audio.pipelines.utils.hook import ProgressHook
from pydub import AudioSegment
from PIL import Image
import cpuinfo
import psutil
from pydantic import BaseModel
from openai import OpenAI

from dotenv import load_dotenv  # new import to load .env file
load_dotenv()  # load environment variables from .env

# ----------------- App Initialization and Configuration -----------------
app = FastAPI()

# CORS configuration (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # adjust as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Directory Setup -----------------
# Directories for speakers, avatars, and conversations.
AVATARS_DIR = "avatars"
os.makedirs(AVATARS_DIR, exist_ok=True)
SPEAKERS_FILE = "speakers.json"

CONVERSATIONS_DIR = "conversations"
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)
GLOBAL_CONVERSATIONS_FILE = os.path.join(CONVERSATIONS_DIR, "conversations.json")
if not os.path.exists(GLOBAL_CONVERSATIONS_FILE):
    with open(GLOBAL_CONVERSATIONS_FILE, "w") as f:
        json.dump([], f)

# Mount folders for static file access.
app.mount("/avatars", StaticFiles(directory="avatars"), name="avatars")
app.mount("/conversations", StaticFiles(directory="conversations"), name="conversations")

# ----------------- Helper Functions -----------------
# --- File Parsing and Processing Helpers ---
def parse_rttm(rttm_file: str):
    """Parse the RTTM file and return a list of segments."""
    segments = []
    with open(rttm_file, 'r') as f:
        for line in f:
            if line.strip() == "":
                continue
            parts = line.strip().split()
            start = float(parts[3])
            duration = float(parts[4])
            end = start + duration
            speaker = parts[7]
            segments.append({"start": start, "end": end, "speaker": speaker})
    return segments

def assign_speaker_to_segment(transcript_seg: dict, rttm_segments: list):
    """Assign a speaker to a transcript segment based on maximum overlap."""
    transcript_start = transcript_seg["start"]
    transcript_end = transcript_seg["end"]
    max_overlap = 0
    best_speaker = "Unknown"
    for r_seg in rttm_segments:
        overlap = min(transcript_end, r_seg["end"]) - max(transcript_start, r_seg["start"])
        if overlap > max_overlap and overlap > 0:
            max_overlap = overlap
            best_speaker = r_seg["speaker"]
    return best_speaker

def combine_transcript_and_rttm(transcript_segments: list, rttm_segments: list):
    """Combine transcript segments with diarization speaker info."""
    combined = []
    for seg in transcript_segments:
        speaker = assign_speaker_to_segment(seg, rttm_segments)
        combined.append({
            "start": seg["start"],
            "end": seg["end"],
            "speaker": speaker,
            "text": seg["text"]
        })
    combined.sort(key=lambda x: x["start"])
    return combined

def remap_speakers(combined_segments: list, speaker_names: list):
    """
    Remap speaker labels using the provided list of names.
    If there are more unique speakers than names, extra speakers retain their label.
    """
    unique_speakers = []
    for seg in combined_segments:
        if seg["speaker"] not in unique_speakers:
            unique_speakers.append(seg["speaker"])
    mapping = {}
    for idx, sp in enumerate(unique_speakers):
        mapping[sp] = speaker_names[idx] if idx < len(speaker_names) else sp
    for seg in combined_segments:
        seg["speaker"] = mapping[seg["speaker"]]
    return combined_segments

def merge_consecutive_segments(segments: list):
    """Merge consecutive segments if they have the same speaker."""
    if not segments:
        return []
    merged_segments = [segments[0]]
    for seg in segments[1:]:
        last_seg = merged_segments[-1]
        if seg["speaker"] == last_seg["speaker"]:
            last_seg["end"] = seg["end"]
            last_seg["text"] = last_seg["text"].strip() + " " + seg["text"].strip()
        else:
            merged_segments.append(seg)
    return merged_segments

def seconds_to_string(seconds: float):
    """
    Helper function to convert seconds to a string format.
    
    Example: 3672 -> 1h 1m 12s
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = int(seconds % 60)
    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if seconds > 0:
        parts.append(f"{seconds}s")
    return " ".join(parts) if parts else "0s"

# --- Audio Processing Helpers ---
def process_diarization(audio_path: str, auth_token: str, device: str):
    """Run the diarization pipeline on the given audio file."""
    pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=auth_token)
    pipeline.to(torch.device(device))
    with ProgressHook() as hook:
        diarization = pipeline(audio_path, hook=hook)
    rttm_path = "example.rttm"
    with open(rttm_path, "w") as f:
        diarization.write_rttm(f)
    return rttm_path

def process_transcription(audio_path: str, model_string: str, device: str):
    """Run the Whisper transcription on the given audio file."""
    model = whisper.load_model(model_string, device=device)
    result = model.transcribe(audio_path, language="en", task="transcribe")
    return result

def create_speaker_audio_segments(conv_id: str, conversation: dict, conv_folder: str):
    """
    Create speaker audio segments based on the RTTM file.
    The RTTM file is expected to have lines like:
    SPEAKER <file_id> 1 <start> <duration> <NA> <NA> <speaker_label> <NA> <NA>
    Groups segments by speaker and saves the combined audio for each speaker
    in a subfolder "speakerAudioSegments" within conv_folder.
    Returns a list of dictionaries with keys: speaker, audio_file, and duration.
    """

    # Define the subfolder to store speaker audio segments.
    segments_folder = os.path.join(conv_folder, "speakerAudioSegments")
    os.makedirs(segments_folder, exist_ok=True)

    # Locate the RTTM file.
    rttm_file = os.path.join(conv_folder, f"{conv_id}.rttm")
    if not os.path.exists(rttm_file):
        raise Exception("RTTM file not found.")

    # Parse RTTM file and group segments by speaker.
    speaker_segments = {}
    with open(rttm_file, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            try:
                start = float(parts[3])
                duration = float(parts[4])
                end = start + duration
            except Exception:
                continue
            generic_speaker = parts[7]
            speaker_segments.setdefault(generic_speaker, []).append((start, end))

    # Locate the original audio file.
    audio_path_wav = os.path.join(conv_folder, f"{conv_id}.wav")
    audio_path_mp3 = os.path.join(conv_folder, f"{conv_id}.mp3")
    if os.path.exists(audio_path_wav):
        audio_path = audio_path_wav
    elif os.path.exists(audio_path_mp3):
        audio_path = audio_path_mp3
    else:
        raise Exception("Original audio file not found.")

    # Load the original audio using pydub.
    audio = AudioSegment.from_file(audio_path)

    # Process each speaker's segments, combine them, and export the audio.
    speaker_audios = []
    for idx, (generic_sp, segments) in enumerate(speaker_segments.items()):
        combined_audio = AudioSegment.empty()
        for start, end in sorted(segments, key=lambda x: x[0]):
            start_ms = int(start * 1000)
            end_ms = int(end * 1000)
            combined_audio += audio[start_ms:end_ms]
        speaker_audio_file = os.path.join(segments_folder, f"SPEAKER_{idx:02d}_{conv_id}.mp3")
        combined_audio.export(speaker_audio_file, format="mp3")
        duration_sec = len(combined_audio) / 1000.0
        speaker_audios.append({
            "speaker": f"SPEAKER_{idx:02d}",
            "audio_file": speaker_audio_file,
            "duration": duration_sec
        })
    return speaker_audios

# --- Filename Utilities and Data Persistence Helpers ---
def sanitize_filename(name: str):
    """Sanitize a string to be used as a filename (remove spaces and special characters)."""
    return re.sub(r'\W+', '', name)

def save_speakers(speakers: list):
    """Save the speakers list to speakers.json in the speakers folder."""
    with open(SPEAKERS_FILE, "w") as f:
        json.dump(speakers, f, indent=2)

def load_speakers():
    """Load the speakers list from speakers.json if it exists."""
    if os.path.exists(SPEAKERS_FILE):
        with open(SPEAKERS_FILE, "r") as f:
            return json.load(f)
    return []

def map_env_tokens_to_names(token_name: str):
    """
    Map a human-readable token name to the corresponding environment variable name.
    """
    mapping = {
        "Hugging Face": "HUGGINGFACE_TOKEN",
        "OpenAI": "OPENAI_API_KEY"
    }
    return mapping.get(token_name)

def mask_token(token: str):
    """
    Mask a token by revealing only the first 3 and last 3 characters.
    Example: token "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" becomes "hf_****...****QWX"
    """
    if not token or len(token) < 7:
        return token
    return token[:3] + "****...****" + token[-3:]

def load_api_tokens():
    """
    Load available API tokens from the environment and mask them.
    """
    tokens = {}
    # iterate over the supported tokens
    for name, env_var in {"Hugging Face": "HUGGINGFACE_TOKEN", "OpenAI": "OPENAI_API_KEY"}.items():
        token_val = os.getenv(env_var)
        if token_val:
            tokens[name] = mask_token(token_val)
        else:
            tokens[name] = None
    return tokens

def save_api_token(env_var: str, token_value: str):
    """
    Save or update the token_value for the given env variable in the .env file.
    This function reads the .env file, updates the value for env_var,
    and writes it back.
    """
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    lines = []
    updated = False
    if os.path.exists(env_file):
        with open(env_file, "r") as f:
            for line in f:
                if line.startswith(env_var + "="):
                    lines.append(f"{env_var}={token_value}\n")
                    updated = True
                else:
                    lines.append(line)
    if not updated:
        lines.append(f"{env_var}={token_value}\n")
    with open(env_file, "w") as f:
        f.writelines(lines)
    # Also update the runtime environment
    os.environ[env_var] = token_value

# --- Conversation Management Helpers ---
def load_conversations():
    """Load the conversations list from the global conversations JSON file."""
    if os.path.exists(GLOBAL_CONVERSATIONS_FILE):
        with open(GLOBAL_CONVERSATIONS_FILE, "r") as f:
            return json.load(f)
    return []

def save_conversations(conversations: list):
    """Save the conversations list to the global conversations JSON file."""
    with open(GLOBAL_CONVERSATIONS_FILE, "w") as f:
        json.dump(conversations, f, indent=2)

def update_conversation_state(conv_id: str, state_name: str, value: bool):
    """Update the state flag for a given conversation."""
    conversations = load_conversations()
    for conv in conversations:
        if conv["id"] == conv_id:
            if "states" not in conv:
                conv["states"] = {
                    "diarization": False,
                    "transcription": False,
                    "speakerAssignment": False,
                    "report": False,
                    "stats": False
                }
            conv["states"][state_name] = value
    save_conversations(conversations)


# ----------------- API Endpoints -----------------
# --- Avatar Endpoints ---
@app.post("/upload-cropped-avatar")
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


# --- Audio Processing Endpoints ---
@app.post("/process")
async def process_audio(
    file: UploadFile = File(...),
    auth_token: str = Form(...),
    model_string: str = Form(default="large-v3-turbo"),
    speaker_names: str = Form(default="")  # Expect comma-separated speaker names, e.g., "Alice,Bob"
):
    """
    Process an audio file to perform diarization and transcription.
    Returns streaming JSON messages with progress updates.
    """
    async def process_generator():
        try:
            # Save the uploaded audio file
            contents = await file.read()
            audio_path = "temp_audio_file.wav"
            with open(audio_path, "wb") as f_out:
                f_out.write(contents)
            yield json.dumps({"status": "success", "message": "Audio uploaded successfully."}) + "\n"
            
            # Start diarization
            yield json.dumps({"status": "info", "message": "Starting diarization..."}) + "\n"
            device = "cuda" if torch.cuda.is_available() else "cpu"
            rttm_file = process_diarization(audio_path, auth_token, device)
            yield json.dumps({"status": "success", "message": "Diaratization complete."}) + "\n"
            
            # Start transcription
            yield json.dumps({"status": "info", "message": "Starting transcription..."}) + "\n"
            transcript_result = process_transcription(audio_path, model_string, device)
            yield json.dumps({"status": "success", "message": "Transcription complete."}) + "\n"
            
            # Combine diarization and transcription
            transcript_segments = transcript_result.get("segments", [])
            if not transcript_segments:
                yield json.dumps({"status": "error", "message": "No timestamped segments found in transcript."}) + "\n"
                return
            
            rttm_segments = parse_rttm(rttm_file)
            combined_segments = combine_transcript_and_rttm(transcript_segments, rttm_segments)
            
            # Remap speakers if provided (expects comma-separated values)
            speakers_list = [s.strip() for s in speaker_names.split(",")] if speaker_names else []
            if speakers_list:
                combined_segments = remap_speakers(combined_segments, speakers_list)
            merged_segments = merge_consecutive_segments(combined_segments)
            
            # Save merged transcript for later retrieval
            merged_file = "merged_transcript.txt"
            with open(merged_file, "w") as f:
                for seg in merged_segments:
                    line = f"[{seg['start']:.2f}-{seg['end']:.2f}] {seg['speaker']}: {seg['text']}\n"
                    f.write(line)
            yield json.dumps({
                "status": "success",
                "message": "Processing complete.",
                "merged_transcript": merged_segments
            }) + "\n"
        except Exception as e:
            yield json.dumps({"status": "error", "message": str(e)}) + "\n"
    
    return StreamingResponse(process_generator(), media_type="text/plain")

@app.get("/files")
async def list_files():
    """
    List generated files with common extensions (e.g. .rttm, .json, .txt).
    """
    allowed_extensions = (".rttm", ".json", ".txt")
    files = [f for f in os.listdir(".") if f.endswith(allowed_extensions)]
    return {"files": files}

@app.get("/files/{filename}")
async def get_file(filename: str):
    """
    Return a file by filename.
    """
    if os.path.exists(filename):
        return FileResponse(filename)
    else:
        raise HTTPException(status_code=404, detail="File not found.")


# --- Speaker Management Endpoints ---
@app.post("/speakers")
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

@app.get("/speakers")
async def get_speakers():
    """
    Get the list of speakers.
    """
    speakers = load_speakers()
    return {"speakers": speakers}

@app.get("/speakers/{speaker_id}")
async def get_speaker(speaker_id: str):
    speakers = load_speakers()
    speaker = next((s for s in speakers if s["id"] == speaker_id), None)
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found.")
    return {"speaker": speaker}

@app.put("/speakers/{speaker_id}")
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

@app.delete("/speakers/{speaker_id}")
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

@app.put("/conversation/{conv_id}/assign-speakers")
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

# --- Conversation Management Endpoints ---
@app.post("/conversation/initialize")
async def initialize_conversation(
    name: str = Form(...),
    conv_id: str = Form(default=""),     # Optional ID, auto-generated if not provided.
):
    """
    Initialize a conversation.
    Computes a conversation ID from the name (MD5 hash) and creates a conversation record
    with default state flags (all false). Also creates the conversation folder.
    Returns the conversation record and the device (GPU or CPU) available.
    """
    if conv_id == "":
        conv_id = hashlib.md5(name.encode()).hexdigest()
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        conversation = {
            "id": conv_id,
            "name": name,
            "description": "",          # Description is empty by default.
            "dateCreated": time.time(),
            "dateOfConversation": None,
            "speakers": [],
            "speakerCount": 0,          # Number of speakers as determined by the diarization process.
            "length": 0,                # Length of the audio in seconds.
            "states": {
                "audioAvailable": False,
                "diarization": False,
                "transcript": False,
                "speakerAudioSegments": False,
                "speakerAssignment": False,
                "report": False,
                "stats": False
            },
            "diarizationProcess": {
                "timeStarted": None,    # Timestamp when the diarization process started.
                "timeCompleted": None,  # Timestamp when the diarization process completed.
                "logs": [],             # Latest logs from the diarization process.
                "device": None,         # Device used for processing (GPU or CPU; name of the device).
            },
            "transcriptionProcess": {
                "timeStarted": None,    # Timestamp when the transcription process started.
                "timeCompleted": None,  # Timestamp when the transcription process completed.
                "logs": [],             # Latest logs from the transcription process.
                "device": None,         # Device used for processing (GPU or CPU; name of the device).
            },
            "backgroundImage": None,    # Optional background image for the conversation.
        }
        conversations.append(conversation)
        save_conversations(conversations)
        folder_name = f"{conv_id}_{sanitize_filename(name)}"
        conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
        os.makedirs(conv_folder, exist_ok=True)
        
    return {"conversation": conversation}

@app.get("/conversation/{conv_id}")
async def get_conversation(conv_id: str):
    """
    Get the conversation details by ID.
    Returns the conversation record with all its properties.
    """
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"conversation": conversation}

@app.get("/conversations")
async def get_conversations():
    """
    Get the list of conversations.
    Each conversation has:
      - id
      - name
      - description
      - speakers (list of IDs)
      - length
    """
    conversations = load_conversations()
    return {"conversations": conversations}


@app.post("/conversations")
async def create_conversation(
    id: str = Form(...),
    name: str = Form(...),
    description: str = Form(...),
    speakers: str = Form(...),  # Comma-separated speaker IDs.
    length: str = Form(default="0")
):
    """
    Create a new conversation.
    This adds the conversation to the global JSON file and creates a folder for it.
    Folder name is "ID_Name" (with Name sanitized).
    """
    conversations = load_conversations()
    # Check for duplicate conversation by ID.
    if any(conv["id"] == id for conv in conversations):
        raise HTTPException(status_code=400, detail="Conversation with this ID already exists.")
    conv = {
        "id": id,
        "name": name,
        "description": description,
        "speakers": [s.strip() for s in speakers.split(",") if s.strip()],
        "length": length
    }
    conversations.append(conv)
    save_conversations(conversations)
    # Create a dedicated folder for this conversation.
    folder_name = f"{id}_{sanitize_filename(name)}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
    os.makedirs(conv_folder, exist_ok=True)
    return {"message": "Conversation created successfully.", "conversation": conv}

@app.put("/conversation/{conv_id}/update-speakers")
async def update_conversation_speakers(conv_id: str, speakers: str = Form(...)):
    """
    Update the speakers list for a conversation.
    Only speaker IDs will be saved and duplicates are removed.
    """
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    # Process the provided speakers string: remove duplicates and empty entries.
    speakers_list = list(dict.fromkeys(s.strip() for s in speakers.split(",") if s.strip()))
    conversation["speakers"] = speakers_list
    conversation.setdefault("states", {})["speakerAssignment"] = bool(speakers_list)
    save_conversations(conversations)

    return {"message": "Conversation speakers updated successfully.", "speakers": speakers_list}

@app.get("/conversations/health/{conv_id}")
async def conversation_health(conv_id: str):
    """
    Check the health of a conversation with the given ID.
    Looks for:
      - Audio file: either "ID.wav" or "ID.mp3"
      - RTTM file: "ID.rttm"
      - Raw transcript: "rawTranscript_ID.json"
      - Final transcript: "finalTranscript_ID.json"
    Returns a status message of what is missing.
    """
    conversations = load_conversations()
    conv = next((c for c in conversations if c["id"] == conv_id), None)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    folder_name = f"{conv['id']}_{sanitize_filename(conv['name'])}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
    missing = []
    # Check for an audio file (either .wav or .mp3)
    if not (os.path.exists(os.path.join(conv_folder, f"{conv['id']}.wav")) or 
            os.path.exists(os.path.join(conv_folder, f"{conv['id']}.mp3"))):
        missing.append("Audio file (wav or mp3)")
    if not os.path.exists(os.path.join(conv_folder, f"{conv['id']}.rttm")):
        missing.append("RTTM file")
    if not os.path.exists(os.path.join(conv_folder, f"rawTranscript_{conv['id']}.json")):
        missing.append("Raw transcript")
    if not os.path.exists(os.path.join(conv_folder, f"finalTranscript_{conv['id']}.json")):
        missing.append("Final transcript")
    status = "All files are present." if not missing else "Missing: " + ", ".join(missing)
    return {"conversation_id": conv_id, "status": status}

@app.post("/conversation/diarize")
async def conversation_diarize(
    conv_id: str = Form(...),
    media_type: str = Form(...),  # "audio", "video", "youtube" (only audio supported now)
    hf_auth_token: str = Form(None),  # Optional Hugging Face auth token
    num_speakers: int = Form(default=0)  # Optional number of speakers
):
    async def diarize_generator():
        # Load conversations first.
        conversations = load_conversations()
        conversation = next((c for c in conversations if c["id"] == conv_id), None)
        if not conversation:
            yield json.dumps({"status": "error", "message": "Conversation not initialized."}) + "\n"
            return
        # Set conv_obj to the loaded conversation.
        conv_obj = conversation
        # Reset the diarization process logs to avoid confusion.
        conversation.setdefault("diarizationProcess", {})
        conversation["diarizationProcess"]["logs"] = []

        # Helper for logging and yielding messages.
        def log_and_yield(status, msg):
            conv_obj.setdefault("diarizationProcess", {}).setdefault("logs", []).append({
                "status": status,
                "message": msg
            })
            save_conversations(conversations)
            return json.dumps({"status": status, "message": msg}) + "\n"

        # Token selection logic.
        provided_token = hf_auth_token.strip() if hf_auth_token else ""
        env_token = os.getenv("HUGGINGFACE_TOKEN")
        if provided_token:
            token_to_use = provided_token
            yield log_and_yield("info", "Hugging Face token provided; using overridden token.")
        elif env_token:
            token_to_use = env_token
            yield log_and_yield("info", "Hugging Face token obtained from environment.")
        else:
            yield log_and_yield("error", "No Hugging Face token provided or found in environment.")
            return

        folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
        conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
        os.makedirs(conv_folder, exist_ok=True)
        # Check for audio file.
        audio_path_wav = os.path.join(conv_folder, f"{conv_id}.wav")
        audio_path_mp3 = os.path.join(conv_folder, f"{conv_id}.mp3")
        if os.path.exists(audio_path_wav):
            audio_path = audio_path_wav
        elif os.path.exists(audio_path_mp3):
            audio_path = audio_path_mp3
        else:
            yield log_and_yield("error", "Audio file not found. Please upload it first.")
            return

        # Initialize process stats for diarization without resetting logs.
        conversation["diarizationProcess"]["timeStarted"] = time.time()
        if torch.cuda.is_available():
            device_name = torch.cuda.get_device_name(0)
        else:
            info = cpuinfo.get_cpu_info()
            device_name = f"{info.get('brand_raw', 'Unknown')} ({info.get('arch', 'Unknown')})"
        conversation["diarizationProcess"]["device"] = device_name
        save_conversations(conversations)

        yield log_and_yield("info", f"Device check complete. Using {device_name}.")
        yield log_and_yield("info", "Setting up the pyannote pipeline...")
        yield log_and_yield("info", "Starting diarization...")
        start_time = time.time()
        try:
            output_rttm = os.path.join(conv_folder, f"{conv_id}.rttm")
            pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=token_to_use)
            pipeline.to(torch.device("cuda" if torch.cuda.is_available() else "cpu"))
            with ProgressHook() as hook:
                if num_speakers == 0:
                    diarization = pipeline(audio_path, hook=hook)
                else:
                    diarization = pipeline(audio_path, num_speakers=num_speakers, hook=hook)
            with open(output_rttm, "w") as f:
                diarization.write_rttm(f)
            elapsed = time.time() - start_time
            yield log_and_yield("success", f"Diarization completed in {elapsed:.2f} seconds.")
            conversation["diarizationProcess"]["timeCompleted"] = time.time()
            save_conversations(conversations)
            yield log_and_yield("success", "Files saved to conversation.")
            update_conversation_state(conv_id, "diarization", True)
        except Exception as e:
            yield log_and_yield("error", str(e))
    return StreamingResponse(diarize_generator(), media_type="text/event-stream")

@app.post("/conversation/upload_audio")
async def upload_audio(
    conv_id: str = Form(...),
    media_type: str = Form(...),  # Must be "audio"
    file: UploadFile = File(...)
):
    if media_type != "audio":
        raise HTTPException(status_code=400, detail="Only audio processing is supported")
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".wav") or filename_lower.endswith(".mp3")):
        raise HTTPException(status_code=400, detail="Invalid file format. Only .wav and .mp3 are allowed.")
    
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
    os.makedirs(conv_folder, exist_ok=True)
    
    ext = ".wav" if filename_lower.endswith(".wav") else ".mp3"
    audio_path = os.path.join(conv_folder, f"{conv_id}{ext}")
    previous_audio = os.path.exists(audio_path)
    contents = await file.read()
    with open(audio_path, "wb") as f:
        f.write(contents)
    
    file_size_mb = len(contents) / (1024 * 1024)
    try:
        audio = AudioSegment.from_file(audio_path)
        duration_sec = len(audio) / 1000.0  # duration in seconds
    except Exception:
        duration_sec = 0
    message = f"Audio uploaded: {file_size_mb:.2f} MB, duration: {seconds_to_string(duration_sec)}"
    if previous_audio:
        message += " Warning: previous audio file was replaced."
    # Convert WAV to MP3 if a WAV file is uploaded
    if ext == ".wav":
        mp3_path = os.path.join(conv_folder, f"{conv_id}.mp3")
        try:
            audio = AudioSegment.from_file(audio_path)
            audio.export(mp3_path, format="mp3")
            message += f" MP3 file also created at {mp3_path}."
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error converting WAV to MP3: {str(e)}")
    # Set state
    conversation_prev_state = conversation.get("states", {}).get("audioAvailable", False)
    conversation["states"]["audioAvailable"] = True
    conversation["length"] = duration_sec
    save_conversations(conversations)
    if duration_sec < 1 or duration_sec > 3600:
        message += " Warning: Audio duration is unplausible."
    return {"status": "success", "message": message, "audio_path": audio_path}

@app.get("/whisper/models")
async def get_whisper_models():
    """
    Returns the list of available Whisper models.
    """
    models = whisper.available_models()
    return {"models": models}

@app.post("/conversation/transcribe")
async def conversation_transcribe(
    conv_id: str = Form(...),
    model_string: str = Form(...)
):
    """
    Transcribe the audio of a conversation using the selected Whisper model.
    Returns streaming JSON messages with progress updates.
    """
    async def transcribe_generator():
        # Load conversations first.
        conversations = load_conversations()
        conversation = next((c for c in conversations if c["id"] == conv_id), None)
        if not conversation:
            yield json.dumps({"status": "error", "message": "Conversation not initialized."}) + "\n"
            return

        # Use conv_obj for consistency.
        conv_obj = conversation

        # Reset the transcription process logs to avoid confusion.
        conv_obj.setdefault("transcriptionProcess", {})
        conv_obj["transcriptionProcess"]["logs"] = []

        # Helper for logging and yielding messages.
        def log_and_yield(status, msg):
            conv_obj.setdefault("transcriptionProcess", {}).setdefault("logs", []).append({
                "status": status,
                "message": msg
            })
            save_conversations(conversations)
            return json.dumps({"status": status, "message": msg}) + "\n"

        # Prepare conversation folder.
        folder_name = f"{conv_id}_{sanitize_filename(conv_obj['name'])}"
        conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
        os.makedirs(conv_folder, exist_ok=True)
        
        # Check for the uploaded audio file (either .wav or .mp3).
        audio_path_wav = os.path.join(conv_folder, f"{conv_id}.wav")
        audio_path_mp3 = os.path.join(conv_folder, f"{conv_id}.mp3")
        if os.path.exists(audio_path_wav):
            audio_path = audio_path_wav
        elif os.path.exists(audio_path_mp3):
            audio_path = audio_path_mp3
        else:
            yield log_and_yield("error", "Audio file not found. Please upload it first.")
            return

        # Initialize process stats for transcription.
        conv_obj["transcriptionProcess"]["timeStarted"] = time.time()
        if torch.cuda.is_available():
            device_name = torch.cuda.get_device_name(0)
        else:
            info = cpuinfo.get_cpu_info()
            device_name = f"{info.get('brand_raw', 'Unknown')} ({info.get('arch', 'Unknown')})"
        conv_obj["transcriptionProcess"]["device"] = device_name
        save_conversations(conversations)

        yield log_and_yield("info", f"Device check complete. Using {device_name}.")
        yield log_and_yield("info", "Starting transcription...")
        start_time = time.time()

        try:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            # Process transcription using your custom function.
            transcript_result = process_transcription(audio_path, model_string, device)
            destination_file = os.path.join(conv_folder, f"rawTranscript_{conv_id}.json")
            with open(destination_file, "w") as f:
                json.dump(transcript_result, f, indent=2)
            elapsed = time.time() - start_time
            yield log_and_yield("success", f"Transcription completed in {elapsed:.2f} seconds.")
            yield log_and_yield("success", f"Transcript saved to conversation.")
            conv_obj["transcriptionProcess"]["timeCompleted"] = time.time()
            save_conversations(conversations)
            update_conversation_state(conv_id, "transcript", True)
        except Exception as e:
            yield log_and_yield("error", str(e))

    return StreamingResponse(transcribe_generator(), media_type="text/event-stream")


@app.get("/conversation/diarization-details/{conv_id}")
async def get_diarization_details(conv_id: str):
    """
    Fetch the raw diarization RTTM file for a given conversation.
    """
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    
    folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
    diarization_file = os.path.join(conv_folder, f"{conv_id}.rttm")
    
    if not os.path.exists(diarization_file):
        raise HTTPException(status_code=404, detail="Diarization file not found.")
    
    with open(diarization_file, "r") as f:
        content = f.read()
    return {"content": content}

@app.get("/conversation/transcription-details/{conv_id}")
async def get_transcription_details(conv_id: str):
    """
    Fetch and return the raw transcription JSON file.
    """
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    
    folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
    transcription_file = os.path.join(conv_folder, f"rawTranscript_{conv_id}.json")
    
    if not os.path.exists(transcription_file):
        raise HTTPException(status_code=404, detail="Transcription file not found.")
    
    with open(transcription_file, "r") as f:
        transcript_data = json.load(f)
    
    return transcript_data

@app.post("/conversation/merge")
async def conversation_merge(
    conv_id: str = Form(...),
    selected_speakers: str = Form(default="")  # Optional comma-separated speaker names
):
    """
    Merge transcription and diarization into a unified transcript.
    Optionally remap speaker labels if selected_speakers is provided.
    Saves the merged transcript and returns the merged segments.
    """
    try:
        conversations = load_conversations()
        conversation = next((c for c in conversations if c["id"] == conv_id), None)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
        conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
        rttm_file = os.path.join(conv_folder, f"{conv_id}.rttm")
        transcription_file = os.path.join(conv_folder, f"rawTranscript_{conv_id}.json")
        if not os.path.exists(rttm_file):
            raise HTTPException(status_code=404, detail="Diarization file not found.")
        if not os.path.exists(transcription_file):
            raise HTTPException(status_code=404, detail="Transcription file not found.")

        # Parse diarization and transcription
        rttm_segments = parse_rttm(rttm_file)
        with open(transcription_file, "r") as f:
            transcript_result = json.load(f)
        transcript_segments = transcript_result.get("segments", [])
        if not transcript_segments:
            raise HTTPException(status_code=400, detail="No transcript segments found.")

        # Combine and optionally remap speakers
        combined_segments = combine_transcript_and_rttm(transcript_segments, rttm_segments)
        if selected_speakers:
            speakers_list = [s.strip() for s in selected_speakers.split(",") if s.strip()]
            if speakers_list:
                combined_segments = remap_speakers(combined_segments, speakers_list)
        merged_segments = merge_consecutive_segments(combined_segments)

        # Save the merged transcript for later use
        merged_file = os.path.join(conv_folder, "merged_transcript.txt")
        with open(merged_file, "w") as f:
            for seg in merged_segments:
                line = f"[{seg['start']:.2f}-{seg['end']:.2f}] {seg['speaker']}: {seg['text']}\n"
                f.write(line)

        return {"status": "success", "message": "Merging complete.", "merged_segments": merged_segments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/conversation/speaker-audios/{conv_id}")
async def get_speaker_audios(conv_id: str):
    """
    Return speaker audio segments for a conversation.
    If the segments do not yet exist, they are created.
    Speaker audio files are stored in a "speakerAudioSegments" subfolder.
    """
    try:
        conversations = load_conversations()
        conversation = next((c for c in conversations if c["id"] == conv_id), None)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
        conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
        segments_folder = os.path.join(conv_folder, "speakerAudioSegments")

        # Check if speaker audio segments already exist.
        segments_exist = os.path.exists(segments_folder) and any(fname.endswith(".mp3") for fname in os.listdir(segments_folder))
        if not segments_exist:
            # Create segments if they don't exist.
            speaker_audios = create_speaker_audio_segments(conv_id, conversation, conv_folder)
            # Update the conversation state.
            conversation["states"]["speakerAudioSegments"] = True
            save_conversations(conversations)
        else:
            # Rebuild the speaker_audios list by reading files from the segments folder.
            speaker_audios = []
            for filename in os.listdir(segments_folder):
                if filename.endswith(".mp3"):
                    # Remove prefix "speaker_" and suffix ".mp3" to get the speaker name.
                    sp = filename[len("speaker_"):-len(".mp3")]
                    audio_file_path = os.path.join(segments_folder, filename)
                    audio = AudioSegment.from_file(audio_file_path)
                    duration_sec = len(audio) / 1000.0
                    speaker_audios.append({
                        "speaker": sp,
                        "audio_file": audio_file_path,
                        "duration": duration_sec
                    })
        return {"status": "success", "speaker_audios": speaker_audios}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversation/health-check/{conv_id}")
async def health_check(conv_id: str):
    """
    Health-check endpoint to verify the existence of required files for a conversation.
    Also updates the conversation states accordingly.
    Checks for:
      - Original audio file (.wav or .mp3)
      - RTTM file
      - Raw transcript file
      - Merged transcript file
      - Speaker audio segments (in "speakerAudioSegments" subfolder)
    The "transcription" state has been renamed to "transcript".
    """
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)

    # Set up file paths
    audio_wav = os.path.join(conv_folder, f"{conv_id}.wav")
    audio_mp3 = os.path.join(conv_folder, f"{conv_id}.mp3")
    audio_exists = os.path.exists(audio_wav) or os.path.exists(audio_mp3)

    rttm_file = os.path.join(conv_folder, f"{conv_id}.rttm")
    rttm_exists = os.path.exists(rttm_file)

    raw_transcript_file = os.path.join(conv_folder, f"rawTranscript_{conv_id}.json")
    raw_transcript_exists = os.path.exists(raw_transcript_file)

    merged_transcript_file = os.path.join(conv_folder, "merged_transcript.txt")
    merged_transcript_exists = os.path.exists(merged_transcript_file)

    segments_folder = os.path.join(conv_folder, "speakerAudioSegments")
    segments_exist = os.path.exists(segments_folder) and any(fname.endswith(".mp3") for fname in os.listdir(segments_folder))

    # Collect missing files based on the cached results
    missing_files = []
    if not audio_exists:
        missing_files.append("Audio file (wav or mp3)")
    if not rttm_exists:
        missing_files.append("RTTM file")
    if not raw_transcript_exists:
        missing_files.append("Raw transcript")
    if not merged_transcript_exists:
        missing_files.append("Merged transcript")
    if not segments_exist:
        missing_files.append("Speaker audio segments")

    # Update conversation states using the cached results
    states = conversation.get("states", {})
    states["audioAvailable"] = audio_exists
    states["diarization"] = rttm_exists
    states["transcript"] = raw_transcript_exists
    states["speakerAudioSegments"] = segments_exist
    states["speakerAssignment"] = bool(conversation.get("speakers"))
    conversation["states"] = states
    save_conversations(conversations)

    status = "All files are present." if not missing_files else "Missing: " + ", ".join(missing_files)
    return {"conversation_id": conv_id, "status": status, "missing_files": missing_files, "states": states}

@app.get("/hardware")
async def hardware_check():
    """
    Hardware-check endpoint to determine if a GPU is available and return details about the hardware.
    """
    # CPU information using cpuinfo and psutil
    cpu_info = cpuinfo.get_cpu_info()
    cpu_brand = cpu_info.get('brand_raw', 'Unknown')
    cpu_arch = cpu_info.get('arch', 'Unknown')
    cpu_freq = psutil.cpu_freq()
    cpu_freq_current = cpu_freq.current if cpu_freq else None
    cpu_count_physical = psutil.cpu_count(logical=False)
    cpu_count_logical = psutil.cpu_count(logical=True)

    cpu_data = {
        "available": True,
        "brand": cpu_brand,
        "architecture": cpu_arch,
        "physicalCores": cpu_count_physical,
        "logicalCores": cpu_count_logical,
        "frequencyCurrentMHz": round(cpu_freq_current, 2) if cpu_freq_current else None,
    }
    
    # GPU information using PyTorch
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        gpu_props = torch.cuda.get_device_properties(0)
        # Convert total memory from bytes to gigabytes
        gpu_total_memory_GB = gpu_props.total_memory / (1024 ** 3)
        gpu_data = {
            "available": True,
            "name": gpu_name,
            "totalMemoryGB": round(gpu_total_memory_GB, 2),
            "computeCapability": f"{gpu_props.major}.{gpu_props.minor}",
            "multiProcessorCount": gpu_props.multi_processor_count,
        }
    else:
        gpu_data = {"available": False}
        
    return {
        "cpu": cpu_data,
        "gpu": gpu_data,
        "torchVersion": torch.__version__,
        "cudaAvailable": torch.cuda.is_available(),
        "cudaVersion": torch.version.cuda if torch.cuda.is_available() else None,
    }

@app.get("/apitokens")
async def get_api_tokens():
    """
    Get the list of API tokens.
    Returns tokens with each token masked.
    """
    tokens = load_api_tokens()
    return {"tokens": tokens}

@app.post("/apitokens")
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

@app.delete("/conversation/{conv_id}")
async def delete_conversation(conv_id: str):
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    # Remove conversation from global JSON
    updated_conversations = [c for c in conversations if c["id"] != conv_id]
    save_conversations(updated_conversations)
    # Delete the conversation folder
    folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
    if os.path.exists(conv_folder):
        shutil.rmtree(conv_folder)
    return {"message": "Conversation deleted successfully."}

@app.get("/conversation/audio-metadata/{conv_id}")
async def audio_metadata(conv_id: str):
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    
    folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
    
    # Check for audio file (wav or mp3)
    audio_path_wav = os.path.join(conv_folder, f"{conv_id}.wav")
    audio_path_mp3 = os.path.join(conv_folder, f"{conv_id}.mp3")
    if os.path.exists(audio_path_wav):
        audio_path = audio_path_wav
    elif os.path.exists(audio_path_mp3):
        audio_path = audio_path_mp3
    else:
        raise HTTPException(status_code=404, detail="Audio file not found.")
    
    stat_info = os.stat(audio_path)
    file_size = stat_info.st_size  # in bytes
    try:
        audio = AudioSegment.from_file(audio_path)
        duration = len(audio) / 1000.0  # duration in seconds
    except Exception:
        duration = 0
    file_type = "wav" if audio_path.endswith(".wav") else "mp3"
    
    return {
        "audio_path": audio_path,
        "file_size_bytes": file_size,
        "duration_sec": duration,
        "file_type": file_type
    }

from pydub import AudioSegment
import os
from fastapi.responses import JSONResponse

@app.get("/audio/{conv_id}")
async def get_audio_file(conv_id: str):
    """
    Fetch the audio file for a conversation. If an MP3 file is not present but a WAV file is,
    convert the WAV file to MP3. Return the relative URL of the MP3 file.
    """
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)

    # Check for audio files
    audio_path_mp3 = os.path.join(conv_folder, f"{conv_id}.mp3")
    audio_path_wav = os.path.join(conv_folder, f"{conv_id}.wav")

    if not os.path.exists(audio_path_mp3):
        if os.path.exists(audio_path_wav):
            # Convert WAV to MP3
            try:
                audio = AudioSegment.from_file(audio_path_wav)
                audio.export(audio_path_mp3, format="mp3")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error converting WAV to MP3: {str(e)}")
        else:
            raise HTTPException(status_code=404, detail="No audio file found.")

    # Return the relative URL of the MP3 file
    relative_url = f"/conversations/{folder_name}/{conv_id}.mp3"
    absolute_url = f"http://localhost:8000{relative_url}"
    return JSONResponse(content={"relative_url": relative_url, "absolute_url": absolute_url})

# Define models for the chat transcript, input request, and output response.
class ChatLine(BaseModel):
    speaker: str
    text: str

class AnalysisRequest(BaseModel):
    transcript: List[ChatLine]  # List of conversation lines (speaker, timing, text)

class AnalysisResponse(BaseModel):
    summary: str
    keynotes: Dict[str, List[str]]  # Each speaker name maps to an array of bullet point keynotes

# Initialize OpenAI API key
@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_conversation(request: AnalysisRequest):
    
    client = OpenAI()
    
    # Read OpenAI API key from environment variable
    client.api_key = os.getenv("OPENAI_API_KEY")
    
    if not client.api_key:
        raise HTTPException(status_code=499, detail="OpenAI API key not set")

    # Check if transcript has the expected format
    if not request.transcript or not isinstance(request.transcript, list):
        raise HTTPException(status_code=400, detail="Transcript must be a non-empty list of chat lines.")

    for line in request.transcript:
        if not line.speaker or not line.text:
            logger.warning("Incomplete chat line found: %s", line)
            raise HTTPException(status_code=400, detail="Each chat line must have a speaker, text, and timing.")
    
    # Format the transcript into a single text block
    transcript_text = "\n".join(
        [f"{line.speaker}: {line.text}" for line in request.transcript]
    )
    logger.info("Formatted transcript: %s", transcript_text)

    # -----------------------------
    # PART 1: Generate Conversation Summary
    # -----------------------------
    summary_system_message = (
        "You are a conversation analysis assistant. "
        "Given a transcript of a conversation formatted as chat lines with speaker, timing, and text, "
        "generate a concise summary that captures the main points and overall sentiment of the conversation. "
        "Provide only the summary with no extra commentary."
        "Don't format the text for markdown, just return the text."
    )
    summary_user_message = f"Transcript:\n\n{transcript_text}"

    try:
        summary_resp = client.responses.create(
            model="gpt-4o-mini",
            input=[
                {
                    "role": "developer",
                    "content": summary_system_message
                },
                {
                    "role": "user",
                    "content": summary_user_message
                }
            ]
        )
        logger.info("Summary response received: %s", summary_resp)
    except Exception as e:
        raise HTTPException(status_code=498, detail=f"Error creating summary: {str(e)}")

    # Extract JSON from the response
    summary_data = json.loads(summary_resp.model_dump_json())
    summary_text = summary_data['output'][0]['content'][0]['text']

    # -----------------------------
    # PART 2: Generate Keynotes for Each Speaker
    # -----------------------------
    # Extract unique speakers from the transcript
    unique_speakers = sorted({line.speaker for line in request.transcript})
    speakers_list_text = ", ".join(unique_speakers)
    logger.info("Unique speakers extracted: %s", speakers_list_text)

    keynotes_system_message = (
        "You are a conversation analysis assistant. "
        "Given a transcript of a conversation formatted as chat lines (speaker, timing, text), "
        "produce keynotes for each speaker found in the transcript. For each speaker, generate bullet points that "
        "highlight key contributions, opinions, or notable points made during the conversation. "
        "Try to scale the number and length of the keynotes to the speaking time of each speaker and be extensive for the most active speakers. "
        "Your answer must be formatted as valid JSON where the keys are the speaker names and the values are arrays of bullet point strings. "
        "Do not include any text outside of a valid JSON object."
    )
    keynotes_user_message = (
        f"Transcript:\n\n{transcript_text}\n\n"
        f"Speakers: {speakers_list_text}"
    )

    try:
        keynotes_resp = client.responses.create(
            model="gpt-4o-mini",
            input=[
                {
                    "role": "developer",
                    "content": keynotes_system_message
                },
                {
                    "role": "user",
                    "content": keynotes_user_message
                }
            ]
        )
        logger.info("Keynotes response received: %s", keynotes_resp)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating keynotes: {str(e)}")

    keynotes_text = json.loads(keynotes_resp.model_dump_json())
    keynotes_text = keynotes_text['output'][0]['content'][0]['text']
    logger.info("Extracted keynotes text: %s", keynotes_text)
    
    # Remove Markdown code block markers
    # This regular expression removes:
    # 1. The opening line that starts with triple backticks (and optional json)
    # 2. The closing triple backticks at the end of the string
    cleaned_text = re.sub(r'^```(?:json)?\n|```$', '', keynotes_text, flags=re.MULTILINE)

    try:
        keynotes_json = json.loads(cleaned_text)
    except json.JSONDecodeError:
        keynotes_json = {"error": [f"Failed to parse keynotes JSON. Raw response: {keynotes_text}"]}

    # Return the analysis response
    return AnalysisResponse(summary=summary_text, keynotes=keynotes_json)