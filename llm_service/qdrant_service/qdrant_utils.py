import os
import PyPDF2
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from typing import List, Optional


class VectorSearch:
    
    def __init__(self, qdrant_url: str = None, api_key: str = None, model_name: str = 'all-MiniLM-L6-v2'):
        """
        Initialize the PDF Vector Search system
        
        Args:
            qdrant_url: Qdrant server URL (if None, loads from env)
            api_key: Qdrant API key (if None, loads from env)
            model_name: Sentence transformer model name
        """
        load_dotenv()
        
        # Qdrant configuration
        self.qdrant_url = qdrant_url or os.getenv("QDRANT_URL")
        self.api_key = api_key or os.getenv("QDRANT_API_KEY")
        
        if not self.qdrant_url or not self.api_key:
            raise ValueError("Qdrant URL and API key must be provided or set in environment variables")
        
        print(f"Qdrant URL: {self.qdrant_url}")
        print(f"API Key: {'*' * (len(self.api_key) - 4) + self.api_key[-4:]}")
        
        # Initialize clients
        self.client = QdrantClient(url=self.qdrant_url, api_key=self.api_key)
        self.model = SentenceTransformer(model_name)
        self.vector_size = self.model.get_sentence_embedding_dimension()
        
        print(f"Loaded model '{model_name}' with {self.vector_size}D embeddings")
    

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF file"""
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        text = ""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page_num, page in enumerate(pdf_reader.pages):
                    page_text = page.extract_text()
                    text += f"\n--- Page {page_num + 1} ---\n{page_text}"
            return text
        except Exception as e:
            raise Exception(f"Error extracting text from PDF: {str(e)}")
    

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Split text into overlapping chunks"""
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk)
            
            # Break if we've reached the end
            if i + chunk_size >= len(words):
                break
        
        return chunks
    

    def setup_collection(self, collection_name: str, recreate: bool = True) -> None:
        """Create or recreate the collection"""
        if self.client.collection_exists(collection_name=collection_name):
            if recreate:
                print(f"Collection '{collection_name}' already exists. Deleting it.")
                self.client.delete_collection(collection_name=collection_name)
            else:
                print(f"Collection '{collection_name}' already exists. Skipping creation.")
                return
        
        # Create collection with proper vector size
        self.client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
        )
        print(f"Created collection '{collection_name}' with {self.vector_size}D vectors")
    

    def store_text_from_pdf(self, pdf_path: str, collection_name: str, chunk_size: int = 500, overlap: int = 50, recreate_collection: bool = True) -> str:
        """
        Process PDF and store in Qdrant
        
        Args:
            pdf_path: Path to the PDF file
            chunk_size: Number of words per chunk
            overlap: Number of overlapping words between chunks
            recreate_collection: Whether to recreate the collection if it exists
            
        Returns:
            Collection name used for storage
        """
        print(f"Processing PDF: {pdf_path}")
        
        print(f"Using collection: {collection_name}")
        
        # Setup collection
        self.setup_collection(collection_name, recreate=recreate_collection)
        
        # Extract text
        text = self.extract_text_from_pdf(pdf_path)
        print(f"Extracted {len(text.split())} words from PDF")
        
        # Split into chunks
        chunks = self.chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        print(f"Created {len(chunks)} text chunks")
        
        # Generate embeddings and create points
        points = []
        for i, chunk in enumerate(chunks):
            # Generate embedding
            embedding = self.model.encode(chunk).tolist()
            
            # Create point
            point = PointStruct(
                id=i,
                vector=embedding,
                payload={
                    "text": chunk,
                    "chunk_id": i,
                    "source": pdf_path,
                    "pdf_name": os.path.basename(pdf_path),
                    "word_count": len(chunk.split()),
                    "chunk_size": chunk_size,
                    "overlap": overlap
                }
            )
            points.append(point)
        
        # Upload to Qdrant in batches
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            self.client.upsert(collection_name=collection_name, points=batch)
            print(f"Uploaded batch {i//batch_size + 1}/{(len(points) + batch_size - 1)//batch_size}")
        
        print(f"Successfully uploaded {len(points)} chunks to collection '{collection_name}'")
        return collection_name
    

    def query_collection(self, collection_name: str, query_text: str, limit: int = 5, score_threshold: float = 0.0) -> Optional[object]:
        """
        Search for similar content in the PDF
        
        Args:
            pdf_path: Path to the PDF file
            query_text: Text to search for
            limit: Maximum number of results to return
            score_threshold: Minimum similarity score
            
        Returns:
            Search results or None if collection doesn't exist
        """
        
        # Check if collection exists
        if not self.client.collection_exists(collection_name=collection_name):
            print(f"Collection '{collection_name}' doesn't exist. Process the PDF first.")
            return None
        
        # Generate embedding for query
        query_embedding = self.model.encode(query_text).tolist()
        
        # Search in Qdrant
        results = self.client.query_points(
            collection_name=collection_name,
            query=query_embedding,
            limit=limit,
            score_threshold=score_threshold,
            with_payload=True
        )
        
        print(f"Found {len(results.points)} results:")
        
        return results
    

    def list_collections(self) -> List[str]:
        """List all collections in Qdrant"""
        collections = self.client.get_collections()
        collection_names = [col.name for col in collections.collections]
        print(f"Available collections: {collection_names}")
        return collection_names
    

    def delete_collection(self, collection_name: str) -> bool:
        """Delete collection for a specific PDF"""
        if self.client.collection_exists(collection_name=collection_name):
            self.client.delete_collection(collection_name=collection_name)
            print(f"Deleted collection '{collection_name}'")
            return True
        else:
            print(f"Collection '{collection_name}' doesn't exist")
            return False
    

    def get_collection_info(self, collection_name: str) -> Optional[dict]:
        """Get information about a collection"""
        if not self.client.collection_exists(collection_name=collection_name):
            print(f"Collection '{collection_name}' doesn't exist")
            return None
        
        info = self.client.get_collection(collection_name=collection_name)
        print(f"Collection '{collection_name}':")
        print(f"  - Points count: {info.points_count}")
        print(f"  - Vector size: {info.config.params.vectors.size}")
        print(f"  - Distance metric: {info.config.params.vectors.distance}")
        
        return {
            "name": collection_name,
            "points_count": info.points_count,
            "vector_size": info.config.params.vectors.size,
            "distance_metric": info.config.params.vectors.distance
        }

if __name__ == "__main__":
    # Example usage
    vector_search = VectorSearch()
    
    collection_name = "redis"
    print(vector_search.get_collection_info(collection_name))
    vector_search.delete_collection(collection_name)
    print(vector_search.get_collection_info(collection_name))

