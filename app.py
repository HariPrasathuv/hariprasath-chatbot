
import spaces

import os
import json
import wave
import tempfile
import subprocess

import gradio as gr
import torch

from vosk import Model, KaldiRecognizer
from transformers import AutoTokenizer, AutoModelForCausalLM


# ============================================================
# 1. LOAD VOSK MODEL
# ============================================================

print("Loading Vosk model...")

VOSK_MODEL_PATH = "vosk-model-small-en-in-0.4"

vosk_model = Model(VOSK_MODEL_PATH)

print("Vosk model loaded.")


# ============================================================
# 2. LOAD QWEN MODEL
# ============================================================

print("Loading Qwen model...")

MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

qwen_model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.float16
)

# IMPORTANT FOR ZEROGPU
# The model must be moved to CUDA at module level.
qwen_model = qwen_model.to("cuda")

print("Qwen model loaded.")


# ============================================================
# 3. CHAT FUNCTION
# ============================================================

# Conversation history
chat_history = []


@spaces.GPU(duration=60)
def chat(message):
    """
    Generate a response from Qwen.
    """

    global chat_history

    if not message or not message.strip():
        return "Please enter a message."

    # Add user message
    chat_history.append({
        "role": "user",
        "content": message
    })

    # Keep only the last 10 messages
    chat_history = chat_history[-10:]

    # Create prompt using Qwen's chat template
    text = tokenizer.apply_chat_template(
        chat_history,
        tokenize=False,
        add_generation_prompt=True
    )

    # Convert prompt to tensors
    inputs = tokenizer(
        text,
        return_tensors="pt"
    )

    # Move input tensors to GPU
    inputs = {
        key: value.to("cuda")
        for key, value in inputs.items()
    }

    # Generate response
    with torch.no_grad():

        output = qwen_model.generate(
            **inputs,
            max_new_tokens=150,
            do_sample=True,
            temperature=0.7,
            top_p=0.9
        )

    # Remove the original prompt tokens
    generated_tokens = output[0][inputs["input_ids"].shape[-1]:]

    # Convert tokens to text
    response = tokenizer.decode(
        generated_tokens,
        skip_special_tokens=True
    ).strip()

    # Add assistant response to history
    chat_history.append({
        "role": "assistant",
        "content": response
    })

    # Keep history limited
    chat_history = chat_history[-10:]

    return response


# ============================================================
# 4. CONVERT AUDIO TO WAV
# ============================================================

def convert_audio_to_wav(audio_file):

    if audio_file is None:
        return None

    output_wav = tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False
    ).name

    command = [
        "ffmpeg",
        "-y",
        "-i",
        audio_file,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-sample_fmt",
        "s16",
        output_wav
    ]

    subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True
    )

    return output_wav


# ============================================================
# 5. VOSK SPEECH RECOGNITION
# ============================================================

def recognize_speech(wav_file):

    wf = wave.open(wav_file, "rb")

    recognizer = KaldiRecognizer(
        vosk_model,
        wf.getframerate()
    )

    recognizer.SetWords(True)

    while True:

        data = wf.readframes(4000)

        if len(data) == 0:
            break

        recognizer.AcceptWaveform(data)

    result = recognizer.FinalResult()

    wf.close()

    result = json.loads(result)

    return result.get("text", "")


# ============================================================
# 6. SPEECH FUNCTION
# ============================================================

def speech(audio_file):

    """
    Convert microphone audio to text using Vosk.
    """

    if audio_file is None:
        return ""

    wav_file = None

    try:

        # Convert browser audio to 16-kHz mono WAV
        wav_file = convert_audio_to_wav(audio_file)

        # Run Vosk
        text = recognize_speech(wav_file)

        return text

    except Exception as e:

        print("Speech recognition error:", e)

        return ""

    finally:

        # Delete temporary WAV file
        if wav_file and os.path.exists(wav_file):

            os.remove(wav_file)


# ============================================================
# 7. GRADIO UI
# ============================================================

with gr.Blocks(title="Hari Prasath Chatbot") as demo:

    gr.Markdown(
        """
        # 🤖 Hari Prasath Chatbot

        Chat with Qwen or use your microphone for speech-to-text.
        """
    )

    # --------------------------------------------------------
    # CHAT
    # --------------------------------------------------------

    gr.Markdown("## 💬 Chat")

    message = gr.Textbox(
        label="Message",
        placeholder="Type your message here...",
        lines=2
    )

    chat_button = gr.Button(
        "Send",
        variant="primary"
    )

    response = gr.Textbox(
        label="Response",
        lines=5
    )

    chat_button.click(
        fn=chat,
        inputs=message,
        outputs=response,
        api_name="chat"
    )


    # --------------------------------------------------------
    # SPEECH
    # --------------------------------------------------------

    gr.Markdown("## 🎤 Speech")

    audio = gr.Audio(
        sources=["microphone"],
        type="filepath",
        label="Record your voice"
    )

    speech_button = gr.Button(
        "Convert Speech to Text"
    )

    speech_text = gr.Textbox(
        label="Recognized Text",
        lines=3
    )

    speech_button.click(
        fn=speech,
        inputs=audio,
        outputs=speech_text,
        api_name="speech"
    )


# ============================================================
# 8. START GRADIO
# ============================================================

demo.launch(
    server_name="0.0.0.0",
    server_port=7860
)
