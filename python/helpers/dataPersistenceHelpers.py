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

CONVERSATIONS_DIR = "conversations"
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)
GLOBAL_CONVERSATIONS_FILE = os.path.join(CONVERSATIONS_DIR, "conversations.json")

SPEAKERS_FILE = "speakers.json"

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