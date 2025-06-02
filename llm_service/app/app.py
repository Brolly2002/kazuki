from flask import Flask, request, jsonify
import ollama
import json
import re

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