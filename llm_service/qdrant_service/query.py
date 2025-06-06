from qdrant_utils import VectorSearch

vector_search = VectorSearch()

query = input("Enter your query: ")

points = vector_search.query_all_collections(
    query_text=query,
    limit=5,
    score_threshold=0.5
)

print(points)
