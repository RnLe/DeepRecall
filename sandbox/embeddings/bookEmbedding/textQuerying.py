# textQuerying.py

import json
import numpy as np
from sentence_transformers import SentenceTransformer

def cosine_similarity(vec1, vec2):
    """
    Compute cosine similarity between two vectors.
    
    Args:
        vec1 (numpy.ndarray): First vector.
        vec2 (numpy.ndarray): Second vector.
    
    Returns:
        float: Cosine similarity score.
    """
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def query_mapped_embeddings(query, mapping_file, model, top_k=3):
    """
    Find the top-k most similar text segments for a given query.
    
    Args:
        query (str): The input query string.
        mapping_file (str): Path to the JSON file containing the mapping of segments and their embeddings.
        model (SentenceTransformer): A SentenceTransformer model for encoding the query.
        top_k (int): The number of top similar segments to return.
    
    Returns:
        list of dict: Each dictionary has keys 'id', 'text', and 'similarity' describing each match.
    """
    # Load the mapped embeddings from the JSON file.
    with open(mapping_file, 'r', encoding='utf-8') as f:
        mapping = json.load(f)
    
    # Compute the embedding for the query.
    query_embedding = model.encode(query)
    
    # Calculate cosine similarity for each segment.
    results = []
    for entry in mapping:
        # Convert the stored embedding (list) to a numpy array
        emb = np.array(entry["embedding"])
        sim = cosine_similarity(query_embedding, emb)
        results.append({
            "id": entry["id"],
            "text": entry["text"],
            "similarity": sim
        })
    
    # Sort results by similarity score, highest first.
    results_sorted = sorted(results, key=lambda x: x["similarity"], reverse=True)
    
    # Return the top-k results.
    return results_sorted[:top_k]