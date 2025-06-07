## Kazuki Workspace 🚀

Kazuki is a productivity toolkit for developers, combining a VS Code extension with a backend LLM service. It offers smart tab management, AI-powered folder structure generation, RAG (Retrieval-Augmented Generation) document ingestion and querying, and automatic removal of unused imports.

---

## Features ✨

### 1. Auto-Close Tabs 🗂️
Automatically closes other tabs when you switch to a new one, helping you keep your workspace tidy and focused.

### 2. AI Folder Structure Generator 🏗️
Describe your project in natural language and generate a complete folder and file structure using an LLM backend.

### 3. RAG Agent Integration 📚🤖
- **Feed Documents:** Upload PDF documents to your custom Retrieval-Augmented Generation (RAG) agent for knowledge ingestion.
- **Query Knowledge Base:** Ask questions and get answers from your uploaded documents directly within VS Code.

### 4. Remove Unused Imports 🧹
Instantly delete unused import statements from your JavaScript and TypeScript files to keep your code clean and efficient.

---

## Folder Structure 🗃️

```
llm_service/
    .gitignore
    requirements.txt
    app/
        app.py
    docs/
        redis.pdf
    qdrant_service/
        build.py
        qdrant_utils.py
        query.py
vsc_extension/
    .gitignore
    package.json
    tsconfig.json
    .vscode/
        launch.json
        settings.json
        tasks.json
    src/
        ast-nodes.md
        autoCloseTabs.ts
        extension.ts
        folderGenerator.ts
        ragManager.ts
        unusedImportsManager.ts
```

---

## Folder and File Explanations 📝

### llm_service/ 🐍
Backend service for AI features, built with Flask, Ollama, and Qdrant.

- **requirements.txt**  
  Python dependencies for the backend.

- **app/**  
  Contains `app.py`, the Flask server that exposes endpoints for folder generation and RAG features.

- **docs/**  
  Example documents (like `redis.pdf`) for RAG ingestion and querying.

- **qdrant_service/**  
  Utilities and scripts for working with the Qdrant vector database:
  - `qdrant_utils.py`: Handles PDF ingestion, chunking, embedding, and vector storage/query.
  - `build.py`: CLI for ingesting PDFs into Qdrant.
  - `query.py`: CLI for querying the vector database.

---

### vsc_extension/ 🧩
Source code for the VS Code extension.

- **package.json**  
  Extension manifest and dependencies.

- **tsconfig.json**  
  TypeScript configuration for the extension.

- **.vscode/**  
  Workspace-specific settings, launch, and task configurations.

- **src/**  
  Main source files for extension features:
  - `autoCloseTabs.ts`: Implements the auto-close tabs feature.
  - `folderGenerator.ts`: Handles AI folder structure generation.
  - `ragManager.ts`: Manages RAG document upload and querying.
  - `unusedImportsManager.ts`: Removes unused imports from code files.
  - `extension.ts`: Entry point and activation logic for the extension.
  - `ast-nodes.md`: Notes on TypeScript AST for import analysis.

---

## Backend Overview 🛠️

- **Flask API**  
  Provides endpoints for folder structure generation and RAG document management (`app/app.py`).

- **Qdrant Vector DB**  
  Stores document embeddings for semantic search and retrieval (`qdrant_service/qdrant_utils.py`).

- **Ollama**  
  Supplies LLM-powered responses for folder generation and document Q&A.

---

Kazuki helps you keep your workspace clean, generate project structures, manage knowledge, and write cleaner code—all from within VS Code! 🎉