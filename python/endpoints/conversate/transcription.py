# ----------------- Imports -----------------
import os
import json
import time
import logging

# Configure the logger at the top level of your application (this might be in your main file)
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import StreamingResponse

import torch
import whisper
import cpuinfo

from dotenv import load_dotenv  # new import to load .env file
load_dotenv()  # load environment variables from .env

# Import helper functions
from helpers.audioHelpers import process_transcription
from helpers.dataPersistenceHelpers import load_conversations, save_conversations, update_conversation_state
from helpers.parsingHelpers import sanitize_filename

AVATARS_DIR = "avatars"
CONVERSATIONS_DIR = "conversations"

router = APIRouter()

@router.get("/whisper/models")
async def get_whisper_models():
    """
    Returns the list of available Whisper models.
    """
    models = whisper.available_models()
    return {"models": models}

@router.post("/transcribe/{conv_id}")
async def conversation_transcribe(
    conv_id: str,
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

@router.get("/conversation/transcription-details/{conv_id}")
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