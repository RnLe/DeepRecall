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

def sanitize_filename(name: str):
    """Sanitize a string to be used as a filename (remove spaces and special characters)."""
    return re.sub(r'\W+', '', name)

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