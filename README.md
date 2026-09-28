# hariprasath-chatbot

Chatbot with the **Qwen2.5 LLM** for chat generation and the **Vosk model** for speech-to-text conversion.

This repository contains the **frontend** of the chatbot, consisting of `index.html`, `style.css`, and `script.js`. The chatbot backend is implemented in `app.py` and is deployed separately on **Hugging Face Spaces**.

The GitHub Pages website communicates with the Hugging Face Space through the Gradio API to connect the frontend with the backend.

### Project Structure

```text
hariprasath-chatbot/
├── index.html
├── style.css
└── script.js
```

The backend `app.py` is hosted on Hugging Face Spaces and is accessed by the GitHub Pages frontend through the API.

### Technologies Used

* **HTML, CSS, JavaScript** – Frontend
* **Qwen2.5** – Chat generation
* **Vosk** – Speech-to-text conversion
* **Gradio** – Backend API
* **Hugging Face Spaces** – Backend deployment
* **GitHub Pages** – Frontend deployment
