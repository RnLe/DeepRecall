import os
import time
import hashlib
import shutil

from fastapi import UploadFile, File, Form, HTTPException, APIRouter
from fastapi.responses import JSONResponse

from pydub import AudioSegment
from dotenv import load_dotenv
load_dotenv()

from helpers.audioHelpers import create_speaker_audio_segments
from helpers.dataPersistenceHelpers import load_conversations, save_conversations
from helpers.parsingHelpers import sanitize_filename, seconds_to_string

router = APIRouter()

AVATARS_DIR = "avatars"
CONVERSATIONS_DIR = "conversations"

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

@router.post("/conversation/initialize")
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

@router.get("/conversation/{conv_id}")
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

@router.get("/conversations")
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

@router.post("/conversations")
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

@router.put("/conversation/{conv_id}/update-speakers")
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

@router.get("/conversations/health/{conv_id}")
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

@router.post("/conversation/upload_audio")
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

@router.get("/conversation/speaker-audios/{conv_id}")
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
    
@router.get("/conversation/health-check/{conv_id}")
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

@router.delete("/conversation/{conv_id}")
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

@router.get("/conversation/audio-metadata/{conv_id}")
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

@router.get("conversation/audio/{conv_id}")
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