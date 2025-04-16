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