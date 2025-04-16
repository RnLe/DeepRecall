# ----------------- Imports -----------------
import os
import json
import re
from typing import List, Dict

import logging

# Configure the logger at the top level of your application (this might be in your main file)
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

from fastapi import HTTPException, APIRouter

from pydantic import BaseModel
from openai import OpenAI

from dotenv import load_dotenv  # new import to load .env file
load_dotenv()  # load environment variables from .env

AVATARS_DIR = "avatars"
CONVERSATIONS_DIR = "conversations"

router = APIRouter()

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
@router.post("/analyze", response_model=AnalysisResponse)
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