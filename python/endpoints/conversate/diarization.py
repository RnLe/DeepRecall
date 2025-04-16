# ----------------- Imports -----------------
import os
import json
import time

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import StreamingResponse

import torch
from pyannote.audio import Pipeline
from pyannote.audio.pipelines.utils.hook import ProgressHook
import cpuinfo

from dotenv import load_dotenv
load_dotenv()

# Import helper functions
from helpers.dataPersistenceHelpers import load_conversations, save_conversations, update_conversation_state
from helpers.parsingHelpers import sanitize_filename

AVATARS_DIR = "avatars"
CONVERSATIONS_DIR = "conversations"

router = APIRouter()

@router.post("/diarize/{conv_id}")
async def conversation_diarize(
    conv_id: str,
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

@router.get("/conversation/diarization-details/{conv_id}")
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