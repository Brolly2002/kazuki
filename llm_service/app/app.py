import os
import re
import sys
import json
import ollama
from flask import Flask, request, jsonify

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from qdrant_service.qdrant_utils import VectorSearch

vector_search = VectorSearch()

app = Flask(__name__)


def generate_folder_structure_prompt(user_prompt):
    """
    Create a detailed prompt for the LLM to generate folder structure.
    """

    system_prompt = f"""
    Based on the following request, generate a clean folder and file structure. 
    List each folder and file path clearly, one per line, using forward slashes (/) to separate folders and files.
    Do NOT include comments, descriptions, or explanations in the paths.
    Do NOT use code blocks or markdown formatting.
    Generate generic files which can be used in most projects of the tech stack mentioned by the user.
    Include common files like README.md, .gitignore, and LICENSE if applicable.
    If the user asks for a specific tech stack, include relevant files and folders
    Eg: .js files for JavaScript projects, .py files for Python projects, etc.

    Just list the paths directly, like:
    
    backend/app/app.py
    backend/requirements.txt
    frontend/src/index.js
    frontend/package.json
    
    User request: {user_prompt}
    
    Generate ONLY the file and folder paths, nothing else:
    """
    
    return system_prompt


@app.route('/generate-structure', methods=['POST'])
def generate_structure():
    """
    Endpoint to generate folder structure based on user prompt.
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({'error': 'Missing prompt in request body'}), 400
        
        user_prompt = data['prompt']
        model = data.get('model', 'llama3.2')  # Default model
        
        # Generate the structure using Ollama
        full_prompt = generate_folder_structure_prompt(user_prompt)
        
        response = ollama.chat(model=model, messages=[
            {
                'role': 'user',
                'content': full_prompt,
            },
        ])
        
        llm_response = response['message']['content']
        
        # Parse the response to create the folder structure
        folder_structure = parse_llm_response_advanced(llm_response)
        print("Parsed Folder Structure:")
        print(json.dumps(folder_structure, indent=2))
        return jsonify({
            'success': True,
            'structure': folder_structure,
            'raw_response': llm_response
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def parse_llm_response_advanced(response):
    """
    Advanced parsing of LLM response to create folder structure.
    """
    structure = {}
    lines = response.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line or not ('/' in line or '\\' in line):
            continue
            
        # Normalize path separators
        path = line.replace('\\', '/')
        
        # Remove common prefixes that might be added by LLM
        path = re.sub(r'^(project/|root/|structure/)', '', path)
        
        # Split the path into components
        components = [comp.strip() for comp in path.split('/') if comp.strip()]
        
        if not components:
            continue
            
        # Build the structure
        for i in range(len(components)):
            current = components[i]
            
            # Initialize current item if not exists
            if current not in structure:
                structure[current] = []
            
            # If this is not the last component, add the next one as child
            if i < len(components) - 1:
                next_item = components[i + 1]
                if next_item not in structure[current]:
                    structure[current].append(next_item)
    
    return structure


@app.route('/upload', methods=['POST'])
def upload_file():
    data = request.get_json()
    pdf_path = data.get('pdf_path')
    print(f"Received PDF path: {pdf_path}")
    vector_search.store_text_from_pdf(pdf_path=pdf_path)
    return jsonify({'message': 'PDF received successfully.'}), 200


@app.route('/query', methods=['POST'])
def query_rag():
    data = request.get_json()
    user_query = data.get('query')
    print(f"Received query: {user_query}")
    points_list = vector_search.query_all_collections(
        query_text=user_query,
        limit=3,
        score_threshold=0.5
    )
    merged_points = []
    for points in points_list:
        for point in points.points:
            print(f"Score: {point.score}, ")
            merged_points.append({
                'score': point.score,
                'text': point.payload['text']
            })
    # sort by score in descending order
    merged_points.sort(key=lambda x: x['score'], reverse=True)
    top_three_points = []
    for i in range(min(3, len(merged_points))):
        top_three_points.append(merged_points[i])

    print("Top 3 points Done:")
    
    full_prompt = f'''
        You are an AI assistant that helps users to answer questions based on the provided context.
        The user has asked: "{user_query}".
        Here are the top 3 relevant points from the context:
        {json.dumps(top_three_points, indent=2)}
        Based on this context, provide a concise and accurate answer to the user's question.
        Do not include any explanations or additional information, just the answer.
        If the context is not sufficient to answer the question, respond with "I don't know".
        If the context is sufficient, provide a direct answer.
        There should be a verbose answer to the user's question.
    '''
    
    # print("Full prompt sent to LLM:")
    # print(full_prompt)
    model = 'llama3.2'

    response = ollama.chat(model=model, messages=[
            {
                'role': 'user',
                'content': full_prompt,
            },
        ])
        
    llm_response = response['message']['content']

    print("LLM Response:")
    print(llm_response)


    return jsonify({'answer': llm_response}), 200




@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint.
    """
    return jsonify({'status': 'healthy', 'message': 'Flask app is running'})


@app.route('/', methods=['GET'])
def home():
    """
    Home endpoint with usage instructions.
    """
    return jsonify({
        'message': 'Folder Structure Generator API',
        'usage': {
            'endpoint': '/generate-structure',
            'method': 'POST',
            'body': {
                'prompt': 'Your project description',
                'model': 'llama3,2 (optional)'
            }
        },
        'example': {
            'request': {
                'prompt': 'Create a Python Flask API with authentication',
                'model': 'llama3.2'
            },
            'response_format': {
                'backend': ['app', 'requirements.txt'],
                'app': ['app.py', 'models.py'],
                'requirements.txt': []
            }
        }
    })


def test_generate_structure_locally(prompt, model='llama3.2'):
    """
    Test the generate_structure function locally without Flask server
    """
    try:
        print(f"Testing with prompt: '{prompt}'")
        print(f"Using model: {model}")
        print("-" * 50)
        
        # Generate the structure using Ollama
        full_prompt = generate_folder_structure_prompt(prompt)
        print("Full prompt sent to LLM:")
        print(full_prompt)
        print("-" * 50)
        
        response = ollama.chat(model=model, messages=[
            {
                'role': 'user',
                'content': full_prompt,
            },
        ])
        
        llm_response = response['message']['content']
        print("LLM Raw Response:")
        print(llm_response)
        print("-" * 50)
        
        # Parse the response
        folder_structure = parse_llm_response_advanced(llm_response)
        
        print("Parsed Structure:")
        print(json.dumps(folder_structure, indent=2))
        print("-" * 50)
        
        return {
            'success': True,
            'structure': folder_structure,
            'raw_response': llm_response
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


if __name__ == '__main__':
    # Test the parsing function
    # sample_response = """
    # backend/app/app.py
    # backend/app/models.py
    # backend/requirements.txt
    # frontend/src/index.js
    # frontend/src/components/Header.js
    # frontend/package.json
    # """
    
    # print("Testing parser:")
    # test_structure = parse_llm_response_advanced(sample_response)
    # print(json.dumps(test_structure, indent=2))

    # test_prompts = [
    #     "Create a simple Python Flask API with authentication",
    #     "Build a React TypeScript project with Redux",
    #     "Create a Node.js Express API with MongoDB"
    # ]
    
    # # Choose which test to run (comment/uncomment as needed)
    # selected_prompt = test_prompts[2]  # Change index to test different prompts
    
    # # Run the test
    # result = test_generate_structure_locally(selected_prompt)
    
    # print(result)
    
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5000)