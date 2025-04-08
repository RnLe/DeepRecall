# textPostprocessing.py

import json
import numpy as np

def map_text_to_embeddings(segments, embeddings, output_file):
    """
    Create a mapping between text segments and their embedding vectors,
    and save this mapping to a file in JSON format.
    
    Each mapping entry is a dictionary with:
      - "id": a unique segment ID,
      - "text": the corresponding text segment,
      - "embedding": a list of floats representing the embedding vector.
    
    Args:
        segments (list of str): List of text segments.
        embeddings (list or numpy.ndarray): The embeddings corresponding to each segment.
            If a numpy array is provided, it will be converted to a list.
        output_file (str): File path to save the mapping.
    
    Raises:
        AssertionError: If number of segments does not equal number of embeddings.
    """
    # Ensure that the number of segments equals the number of embeddings.
    assert len(segments) == len(embeddings), "Number of segments must match number of embeddings."
    
    # If embeddings is a numpy array, convert it to a list.
    if isinstance(embeddings, np.ndarray):
        embeddings = embeddings.tolist()
    
    mapping = []
    # Build the mapping of each segment with its embedding.
    for idx, (segment, emb) in enumerate(zip(segments, embeddings)):
        mapping.append({
            "id": idx,
            "text": segment.strip(),
            "embedding": emb
        })
    
    # Save the mapping to the output file in JSON format.
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2)
    
    print(f"Mapping of text segments to embeddings saved to: {output_file}")