from qdrant_utils import VectorSearch

vector_search = VectorSearch()

pdf_path = input("Enter the path to the PDF file: ")
collection_name = input("Enter a collection name: ")

vector_search.store_text_from_pdf(pdf_path, collection_name)