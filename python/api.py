# main.py

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

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, APIRouter
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

# Import helper functions
from helpers.audioHelpers import process_diarization, create_speaker_audio_segments, process_transcription
from helpers.dataPersistenceHelpers import save_speakers, load_speakers, map_env_tokens_to_names, mask_token, load_api_tokens, save_api_token, load_conversations, save_conversations, update_conversation_state
from helpers.parsingHelpers import parse_rttm, sanitize_filename, assign_speaker_to_segment, combine_transcript_and_rttm, remap_speakers, merge_consecutive_segments, seconds_to_string


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

# ----------------- Endpoint Routers -----------------
from endpoints.files import router as files_router
from endpoints.hardware import router as hardware_router
from endpoints.tokenHandling import router as token_router
from endpoints.conversate.analysis import router as analysis_router
from endpoints.conversate.avatars import router as avatars_router
from endpoints.conversate.chat import router as chat_router
from endpoints.conversate.conversation import router as conversation_router
from endpoints.conversate.diarization import router as diarization_router
from endpoints.conversate.speakers import router as speakers_router
from endpoints.conversate.transcription import router as transcription_router

app.include_router(files_router)
app.include_router(hardware_router)
app.include_router(token_router)
app.include_router(analysis_router)
app.include_router(avatars_router)
app.include_router(chat_router)
app.include_router(conversation_router)
app.include_router(diarization_router)
app.include_router(speakers_router)
app.include_router(transcription_router)