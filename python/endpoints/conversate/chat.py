# ----------------- Imports -----------------
import os
import json

from fastapi import Form, HTTPException, APIRouter

from dotenv import load_dotenv  # load environment variables from .env file
load_dotenv()  # load environment variables from .env

# Import helper functions
from helpers.dataPersistenceHelpers import load_conversations
from helpers.parsingHelpers import parse_rttm, sanitize_filename, combine_transcript_and_rttm, remap_speakers, merge_consecutive_segments

AVATARS_DIR = "avatars"
CONVERSATIONS_DIR = "conversations"

router = APIRouter()

@router.post("/conversation/chatgeneration/{conv_id}")
async def conversation_merge(
    conv_id: str,
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