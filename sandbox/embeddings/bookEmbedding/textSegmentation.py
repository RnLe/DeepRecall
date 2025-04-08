"""
textSegmentation.py

This module provides functions to semantically segment a large text into smaller chunks.
Two approaches are provided:
1. Using NLTK's TextTiling for topic segmentation.
2. Using LangChain's RecursiveCharacterTextSplitter for a configurable chunking approach.
"""

import re
import nltk

# Ensure that the necessary NLTK data is downloaded (only needed once).
# nltk.download('punkt', quiet=False)
# nltk.download('stopwords', quiet=False)

from nltk.tokenize import TextTilingTokenizer

try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
except ImportError:
    RecursiveCharacterTextSplitter = None

def segment_text_texttiling(text, w=20, k=6):
    """
    Segment a text using NLTK's TextTiling algorithm.
    
    Args:
        text (str): The full text to be segmented.
        w (int): Sliding window size (default: 20).
        k (int): Block size (default: 6).
    
    Returns:
        list: A list of text segments.
        
    Note: TextTiling works best when paragraphs are separated by blank lines.
          This function normalizes the text by ensuring a double newline between paragraphs.
    """
    # Normalize paragraph breaks to ensure double newlines
    normalized_text = re.sub(r'\n\s*\n+', '\n\n', text)
    
    ttt = TextTilingTokenizer(w=w, k=k)
    segments = ttt.tokenize(normalized_text)
    return segments

def segment_text_langchain(text, chunk_size=256, chunk_overlap=50):
    """
    Segment a text using LangChain's RecursiveCharacterTextSplitter.
    
    Args:
        text (str): The full text to segment.
        chunk_size (int): Maximum number of characters per chunk (default: 256).
        chunk_overlap (int): Overlap (in characters) between adjacent chunks (default: 50).
    
    Returns:
        list: A list of text chunks.
    
    Raises:
        ImportError: If the langchain library is not installed.
    """
    if RecursiveCharacterTextSplitter is None:
        raise ImportError("LangChain is not installed. Install it using 'pip install langchain'")
    
    # Create a splitter instance; specify a list of separators to try in order of preference.
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = splitter.split_text(text)
    return chunks

def save_segments_to_file(segments, file_path):
    """
    Save text segments to a file with a header for each segment.
    
    Each segment is preceded by a header like 'Segment 1:' and followed by
    two newline characters to clearly separate it from the next segment.
    
    Args:
        segments (list of str): List containing the text segments.
        file_path (str): Output file path where segments will be saved.
    """
    # Open the file in write mode with UTF-8 encoding
    with open(file_path, 'w', encoding='utf-8') as f:
        # Iterate over each segment along with its index
        for idx, segment in enumerate(segments):
            # Write a header for each segment
            f.write(f"Segment {idx + 1}:\n")
            # Write the segment text (stripped to remove any extraneous whitespace)
            f.write(segment.strip())
            # Write two newline characters to separate segments
            f.write("\n\n")