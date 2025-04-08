"""
text_preprocessing.py

This module provides functions to convert a book (in PDF or EPUB format)
into markdown. It includes separate functions for PDF and EPUB processing,
and a top-level function that dispatches based on the file extension.
"""

import os
import re

def pdf_to_text(pdf_path):
    """
    Extracts text from a PDF file using PyMuPDF.

    Args:
        pdf_path (str): Path to the PDF file.
        
    Returns:
        str: Extracted raw text.
    """
    import fitz  # PyMuPDF
    text = ""
    doc = fitz.open(pdf_path)
    for page in doc:
        text += page.get_text() + "\n\n"
    return text

def pdf_to_markdown(pdf_path, output_markdown_path):
    """
    Converts a PDF into a markdown file.
    
    Args:
        pdf_path (str): Path to the PDF file.
        output_markdown_path (str): Path where the markdown file will be saved.
        
    Returns:
        str: The output markdown file path.
    """
    text = pdf_to_text(pdf_path)
    # You can add further processing here (e.g., reformatting headings) if needed.
    with open(output_markdown_path, 'w', encoding='utf-8') as f:
        f.write(text)
    return output_markdown_path

def epub_to_markdown(epub_path, output_markdown_path):
    """
    Converts an EPUB into a markdown file.
    
    Args:
        epub_path (str): Path to the EPUB file.
        output_markdown_path (str): Path where the markdown file will be saved.
        
    Returns:
        str: The output markdown file path.
    """
    from ebooklib import epub
    from bs4 import BeautifulSoup
    import html2text

    # Read the EPUB file
    book = epub.read_epub(epub_path)
    h = html2text.HTML2Text()
    h.ignore_links = False  # Set to True if you want to ignore hyperlinks
    markdown_text = ""
    
    # Iterate over all items in the EPUB
    for item in book.get_items():
        # Instead of comparing to epub.ITEM_DOCUMENT,
        # check if the item is an instance of epub.EpubHtml
        if isinstance(item, epub.EpubHtml):
            # Get the content as HTML, parse it, and convert to markdown
            soup = BeautifulSoup(item.get_content(), 'html.parser')
            md = h.handle(str(soup))
            markdown_text += md + "\n\n"
    
    # Write the combined markdown output to the specified file
    with open(output_markdown_path, 'w', encoding='utf-8') as f:
        f.write(markdown_text)
    
    return output_markdown_path

def convert_book_to_markdown(input_path, output_markdown_path):
    """
    Converts a book in either PDF or EPUB format to markdown.
    The conversion is performed based on the file extension.
    
    Args:
        input_path (str): Path to the input book file (PDF or EPUB).
        output_markdown_path (str): Path to save the markdown file.
        
    Returns:
        str: The output markdown file path.
        
    Raises:
        ValueError: If the file extension is not supported.
    """
    ext = os.path.splitext(input_path)[1].lower()
    if ext == '.pdf':
        return pdf_to_markdown(input_path, output_markdown_path)
    elif ext == '.epub':
        return epub_to_markdown(input_path, output_markdown_path)
    else:
        raise ValueError("Unsupported file format. Supported formats are PDF and EPUB.")


def clean_markdown_text(text):
    """
    Clean the raw markdown text by ensuring:
    - Newlines are normalized.
    - Single newlines within paragraphs are replaced by a space.
    - Any sequence of two or more newlines (paragraph breaks) is collapsed to exactly two newlines.
    - Markdown headers (lines starting with '#') are ensured to start after a paragraph break.
    
    Args:
        text (str): Raw markdown text.
        
    Returns:
        str: Cleaned text with proper paragraph breaks.
    """
    # Normalize newline characters (convert different OS newlines to '\n')
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Ensure that markdown headers always start on a new paragraph.
    # This inserts a double newline before a header, removing any excess newlines.
    text = re.sub(r'\n*(#+)', r'\n\n\1', text)
    
    # Split the text into paragraphs using two or more consecutive newlines as delimiters.
    paragraphs = re.split(r'\n{2,}', text)
    
    # For each paragraph, strip whitespace and join any broken lines (single newline inside a paragraph) with a space.
    paragraphs = [' '.join(p.strip().splitlines()) for p in paragraphs if p.strip()]
    
    # Rejoin paragraphs with exactly two newlines, enforcing that there are no more than two consecutive.
    cleaned_text = "\n\n".join(paragraphs)
    
    return cleaned_text
