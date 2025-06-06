from qdrant_utils import VectorSearch

vector_search = VectorSearch()

query = input("Enter your query: ")
collection_name = input("Enter the collection name to search in: ")

points = vector_search.query_collection(
    collection_name=collection_name,
    query_text=query,
    limit=5,
    score_threshold=0.5
)

if points:
    print("Search Results:")
    for point in points.points:
        print(f"ID: {point.id}, Score: {point.score}, Payload: {point.payload}")    

