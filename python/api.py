# api.py
import os
import json
import time
import re
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import torch
import whisper
import hashlib
from pyannote.audio import Pipeline
from pyannote.audio.pipelines.utils.hook import ProgressHook
from pydub import AudioSegment

app = FastAPI()

# Enable CORS for your frontend (localhost:3000) or use ["*"] for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # adjust as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the avatars folder so that files can be accessed via '/avatars/<filename>'
app.mount("/avatars", StaticFiles(directory="avatars"), name="avatars")

# ----------------- Directory Setup -----------------
# All speaker-related files are stored in the "speakers" folder,
# and avatar images are stored in the "avatars" folder.
SPEAKERS_DIR = "speakers"
AVATARS_DIR = "avatars"
os.makedirs(SPEAKERS_DIR, exist_ok=True)
os.makedirs(AVATARS_DIR, exist_ok=True)
SPEAKERS_FILE = os.path.join(SPEAKERS_DIR, "speakers.json")

# ----------------- Helper Functions -----------------

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
    transcript_json = f"transcript_{model_string}_detailed.json"
    with open(transcript_json, "w") as f:
        json.dump(result, f, indent=2)
    return transcript_json, result

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

# ----------------- API Endpoints -----------------

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
            transcript_file, transcript_result = process_transcription(audio_path, model_string, device)
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


@app.post("/speakers")
async def add_speaker(
    id: str = Form(...),
    name: str = Form(...),
    color: str = Form(...),
    image: UploadFile = File(None)
):
    """
    Add a new speaker. The form-data should include:
      - id: Unique identifier (e.g., MD5 hash of the name)
      - name: Speaker's name
      - color: Ring color for the speaker avatar
      - image: Optional avatar image file
    The avatar image is saved in the avatars folder.
    All speaker data is stored in speakers/speakers.json.
    """
    speakers = load_speakers()
    image_path = None
    if image:
        sanitized = sanitize_filename(name)
        filename = f"{sanitized}_{id}.png"
        image_path = os.path.join(AVATARS_DIR, filename)
        with open(image_path, "wb") as f:
            content = await image.read()
            f.write(content)
    new_speaker = {
        "id": id,
        "name": name,
        "img": image_path,
        "ring_color": color
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

# ----------------- Conversation Management -----------------

# Setup the conversations directory and global JSON file.
CONVERSATIONS_DIR = "conversations"
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)
GLOBAL_CONVERSATIONS_FILE = os.path.join(CONVERSATIONS_DIR, "conversations.json")
if not os.path.exists(GLOBAL_CONVERSATIONS_FILE):
    with open(GLOBAL_CONVERSATIONS_FILE, "w") as f:
        json.dump([], f)

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

# ----------------- Conversation Initialization Endpoint -----------------

@app.post("/conversation/initialize")
async def initialize_conversation(
    name: str = Form(...),
    description: str = Form(default=""),
    speakers: str = Form(default="")
):
    """
    Initialize a conversation.
    Computes a conversation ID from the name (MD5 hash) and creates a conversation record
    with default state flags (all false). Also creates the conversation folder.
    Returns the conversation record and the device (GPU or CPU) available.
    """
    conv_id = hashlib.md5(name.encode()).hexdigest()
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        conversation = {
            "id": conv_id,
            "name": name,
            "description": description,
            "speakers": [s.strip() for s in speakers.split(",") if s.strip()],
            "length": "0",
            "states": {
                "diarization": False,
                "transcription": False,
                "speakerAssignment": False,
                "report": False,
                "stats": False
            }
        }
        conversations.append(conversation)
        save_conversations(conversations)
        folder_name = f"{conv_id}_{sanitize_filename(name)}"
        conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
        os.makedirs(conv_folder, exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return {"conversation": conversation, "device": device}

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

@app.post("/conversation/pipeline")
async def conversation_pipeline(
    conv_id: str = Form(...),
    media_type: str = Form(...),  # "audio", "video", "youtube" (only audio supported now)
    auth_token: str = Form(...)
):
    async def pipeline_generator():
        if media_type != "audio":
            yield json.dumps({"status": "error", "message": "Only audio processing is supported currently."}) + "\n"
            return

        conversations = load_conversations()
        conversation = next((c for c in conversations if c["id"] == conv_id), None)
        if not conversation:
            yield json.dumps({"status": "error", "message": "Conversation not initialized."}) + "\n"
            return

        folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
        conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
        os.makedirs(conv_folder, exist_ok=True)

        # Look for the uploaded audio file.
        audio_path_wav = os.path.join(conv_folder, f"{conv_id}.wav")
        audio_path_mp3 = os.path.join(conv_folder, f"{conv_id}.mp3")
        if os.path.exists(audio_path_wav):
            audio_path = audio_path_wav
        elif os.path.exists(audio_path_mp3):
            audio_path = audio_path_mp3
        else:
            yield json.dumps({"status": "error", "message": "Audio file not found. Please upload it first."}) + "\n"
            return

        device = "cuda" if torch.cuda.is_available() else "cpu"
        yield json.dumps({"status": "info", "message": f"Device check complete. Using {device}."}) + "\n"
        yield json.dumps({"status": "info", "message": "Setting up the pyannote pipeline... done."}) + "\n"
        yield json.dumps({"status": "info", "message": "Starting diarization..."}) + "\n"
        start_time = time.time()
        try:
            output_rttm = os.path.join(conv_folder, f"{conv_id}.rttm")
            pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=auth_token)
            pipeline.to(torch.device(device))
            with ProgressHook() as hook:
                diarization = pipeline(audio_path, hook=hook)
            with open(output_rttm, "w") as f:
                diarization.write_rttm(f)
            elapsed = time.time() - start_time
            yield json.dumps({
                "status": "success",
                "message": f"Starting diarization... done in {elapsed:.2f} seconds."
            }) + "\n"
            update_conversation_state(conv_id, "diarization", True)
            yield json.dumps({"status": "success", "message": "Saving files to the conversation... done."}) + "\n"
        except Exception as e:
            yield json.dumps({"status": "error", "message": str(e)}) + "\n"
    return StreamingResponse(pipeline_generator(), media_type="text/plain")

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
    contents = await file.read()
    with open(audio_path, "wb") as f:
        f.write(contents)
    
    file_size_mb = len(contents) / (1024 * 1024)
    try:
        audio = AudioSegment.from_file(audio_path)
        duration_sec = len(audio) / 1000.0
    except Exception:
        duration_sec = 0
    message = f"Audio uploaded: {file_size_mb:.2f} MB, duration: {duration_sec:.2f} sec."
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
        try:
            # Load the conversation from the global conversations file.
            conversations = load_conversations()
            conversation = next((c for c in conversations if c["id"] == conv_id), None)
            if not conversation:
                yield json.dumps({
                    "status": "error",
                    "message": "Conversation not initialized."
                }) + "\n"
                return

            # Build the conversation folder path.
            folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
            conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
            os.makedirs(conv_folder, exist_ok=True)

            # Look for the uploaded audio file (either .wav or .mp3).
            audio_path_wav = os.path.join(conv_folder, f"{conv_id}.wav")
            audio_path_mp3 = os.path.join(conv_folder, f"{conv_id}.mp3")
            if os.path.exists(audio_path_wav):
                audio_path = audio_path_wav
            elif os.path.exists(audio_path_mp3):
                audio_path = audio_path_mp3
            else:
                yield json.dumps({
                    "status": "error",
                    "message": "Audio file not found. Please upload it first."
                }) + "\n"
                return

            # Inform the client that transcription is starting.
            yield json.dumps({
                "status": "info",
                "message": "Starting transcription..."
            }) + "\n"

            # Determine the device: use 'cuda' if available, else 'cpu'.
            device = "cuda" if torch.cuda.is_available() else "cpu"

            # Run the transcription process.
            transcript_file, transcript_result = process_transcription(audio_path, model_string, device)

            # Save (or overwrite) the transcript into the conversation folder with the naming convention.
            destination_file = os.path.join(conv_folder, f"rawTranscript_{conv_id}.json")
            with open(destination_file, "w") as f:
                json.dump(transcript_result, f, indent=2)

            # Notify the client that transcription is complete.
            yield json.dumps({
                "status": "success",
                "message": "Transcription complete.",
                "transcript_file": destination_file
            }) + "\n"

            # Update the conversation state to mark transcription as completed.
            update_conversation_state(conv_id, "transcription", True)
        except Exception as e:
            yield json.dumps({
                "status": "error",
                "message": str(e)
            }) + "\n"
    
    # Return a streaming response that sends progress messages.
    return StreamingResponse(transcribe_generator(), media_type="text/plain")

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
    Fetch the raw transcription JSON file, beautify it,
    and generate a text output where each line shows the segment timestamp and text.
    """
    conversations = load_conversations()
    conversation = next((c for c in conversations if c["id"] == conv_id), None)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    
    folder_name = f"{conv_id}_{sanitize_filename(conversation['name'])}"
    conv_folder = os.path.join(CONVERSATIONS_DIR, folder_name)
    # We assume the transcription JSON file is saved as rawTranscript_{conv_id}.json in the conversation folder.
    transcription_file = os.path.join(conv_folder, f"rawTranscript_{conv_id}.json")
    
    if not os.path.exists(transcription_file):
        raise HTTPException(status_code=404, detail="Transcription file not found.")
    
    with open(transcription_file, "r") as f:
        transcript_data = json.load(f)
    
    # Create a beautified version of the JSON.
    beautified_json = json.dumps(transcript_data, indent=2)
    
    # Generate timestamp lines (each line with the segment start-end and text).
    timestamp_lines = ""
    for seg in transcript_data.get("segments", []):
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        text = seg.get("text", "").strip()
        timestamp_lines += f"[{start:.2f}-{end:.2f}] {text}\n"
    
    return {"beautified_json": beautified_json, "timestamp_lines": timestamp_lines}


