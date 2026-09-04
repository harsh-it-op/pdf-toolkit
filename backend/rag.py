"""RAG (Retrieval-Augmented Generation) for PDFForge.
Uses ChromaDB for vector storage and sentence-transformers for embeddings.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import List, Tuple

import chromadb
from chromadb.utils import embedding_functions
import openai
from pypdf import PdfReader

# --- config --------------------------------------------------------------------

# ponytail: store vector indices in the project's storage directory.
VECTORS_DIR = os.environ.get("PDFFORGE_VECTORS_DIR", "./storage/vectors")

# Use a local embedding model to avoid API costs and latency for embedding.
# 'all-MiniLM-L6-v2' is small, fast, and effective.
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

client = chromadb.PersistentClient(path=VECTORS_DIR)


def index_pdf(
    file_id: str,
    path: Path,
    progress: callable | None = None,
) -> None:
    """Extract text from PDF, chunk it, and store embeddings in ChromaDB."""
    progress and progress(5, "extracting text")

    reader = PdfReader(str(path))
    text_parts = []
    for i in range(len(reader.pages)):
        page_text = reader.pages[i].extract_text()
        if page_text:
            text_parts.append(page_text)
        if progress:
            pct = 5 + int(30 * (i + 1) / len(reader.pages))
            progress(pct, f"reading page {i+1}/{len(reader.pages)}")

    full_text = "\n".join(text_parts)
    if not full_text.strip():
        # ponytail: if no text, indexing is pointless.
        return

    progress and progress(40, "chunking text")
    # ponytail: simple sliding window chunking.
    # 500 characters with 50 overlap to preserve context.
    chunks = []
    chunk_size = 500
    overlap = 50
    for i in range(0, len(full_text), chunk_size - overlap):
        chunks.append(full_text[i : i + chunk_size])

    progress and progress(60, "generating embeddings")
    # ponytail: create or get a collection for this PDF.
    # Collection names must match [a-z0-9_].
    collection_name = f"pdf_{file_id}"
    collection = client.get_or_create_collection(
        name=collection_name,
        embedding_function=embedding_fn,
    )

    # Batch upload embeddings to avoid overhead.
    ids = [f"chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"page": "unknown"} for _ in range(len(chunks))] # Simple metadata

    # chroma handles the embedding calls via the embedding_function.
    collection.add(
        documents=chunks,
        ids=ids,
        metadatas=metadatas,
    )

    progress and progress(100, "done")


def query_pdf(file_id: str, question: str) -> str:
    """Retrieve relevant chunks from ChromaDB and answer via LLM."""
    collection_name = f"pdf_{file_id}"
    try:
        collection = client.get_collection(name=collection_name, embedding_function=embedding_fn)
    except Exception:
        # ponytail: index might not exist yet.
        return "This PDF has not been indexed for chat. Please index it first."

    # Retrieve top 5 relevant chunks.
    results = collection.query(
        query_texts=[question],
        n_results=5,
    )

    # Combine retrieved documents into a context block.
    context_chunks = results["documents"][0]
    context = "\n---\n".join(context_chunks)

    progress_msg = "Synthesizing answer..."
    # ponytail: prompt construction for RAG.
    prompt = (
        "You are a helpful AI assistant. Use the following context extracted from a PDF "
        "to answer the user's question. If the answer is not in the context, say "
        "that you don't know based on the document.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer:"
    )

    llm_client = openai.OpenAI()
    try:
        response = llm_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error calling LLM: {str(e)}"
