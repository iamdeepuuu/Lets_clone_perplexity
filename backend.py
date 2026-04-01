import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from PyPDF2 import PdfReader
import io

# 1. Load environment variables
load_dotenv()

# 2. Configure Gemini API Settings
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL_NAME = "gemini-2.5-flash" 
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GOOGLE_API_KEY}"

# 3. Memory Architecture: Store uploaded context
# In this simple version, we'll store the context in an in-memory dictionary.
# In a production app, you'd use a database or session management.
app_context = {
    "file_content": None,
    "file_name": None
}

# 4. Initialize Flask App
app = Flask(__name__)
CORS(app)

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        # Read PDF content using PyPDF2
        if file.filename.endswith('.pdf'):
            pdf_reader = PdfReader(file)
            extracted_text = ""
            for page in pdf_reader.pages:
                extracted_text += page.extract_text() + "\n"
            
            app_context["file_content"] = extracted_text
            app_context["file_name"] = file.filename
            
            return jsonify({
                "status": "success",
                "message": "File successfully indexed",
                "file_name": file.filename,
                "preview": extracted_text[:200] + "..."
            })
        else:
            return jsonify({"error": "Unsupported file format. Please upload a PDF."}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ask', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get("message")
        
        if not user_message:
            return jsonify({"error": "No message provided"}), 400
        
        if not GOOGLE_API_KEY:
            return jsonify({"error": "API Key is missing. Please configure GOOGLE_API_KEY in .env"}), 500

        # RAG Logic Replacement: 
        # Since Gemini 2.5 has a massive context window, we inject the PDF content directly.
        final_prompt = user_message
        if app_context["file_content"]:
            final_prompt = f"Context from uploaded file '{app_context['file_name']}':\n{app_context['file_content']}\n\nUser Question: {user_message}"

        # Prepare payload for Gemini REST API
        payload = {
            "contents": [
                {
                    "parts": [{"text": final_prompt}]
                }
            ]
        }

        # Make the request to Google's API
        response = requests.post(GEMINI_URL, json=payload)
        response_data = response.json()

        # Handle API errors
        if response.status_code != 200:
            return jsonify({"error": response_data.get("error", {}).get("message", "API Error")}), response.status_code

        # Extract text from the response
        try:
            generated_text = response_data['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError):
            generated_text = "Sorry, I couldn't generate a response."

        return jsonify({
            "response": generated_text,
            "status": "success"
        })

    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/reset-context', methods=['POST'])
def reset_context():
    app_context["file_content"] = None
    app_context["file_name"] = None
    return jsonify({"status": "success", "message": "Context cleared"})

if __name__ == '__main__':
    print(f"Backend active. Ready for RAG with model: {MODEL_NAME}")
    app.run(port=5000, debug=True)
