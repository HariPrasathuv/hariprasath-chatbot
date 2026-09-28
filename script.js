
const HF_SPACE_URL =
    "https://hariprasathuv-hariprasath-chatbot-2-0.hf.space";

// ============================================================
// DOM ELEMENTS
// ============================================================

const chatBox =
    document.getElementById("chatBox");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const micButton =
    document.getElementById("micButton");

const statusText =
    document.getElementById("statusText");


// ============================================================
// STATE
// ============================================================

let mediaRecorder = null;

let audioChunks = [];

let recordingTimer = null;

let isRecording = false;


// ============================================================
// ADD MESSAGE
// ============================================================

function addMessage(message, sender) {

    const messageDiv =
        document.createElement("div");

    messageDiv.classList.add(
        "message",
        sender === "user"
            ? "user-message"
            : "bot-message"
    );


    const avatar =
        document.createElement("div");

    avatar.classList.add(
        "message-avatar"
    );

    avatar.textContent =
        sender === "user"
            ? "👤"
            : "🤖";


    const content =
        document.createElement("div");

    content.classList.add(
        "message-content"
    );


    const name =
        document.createElement("div");

    name.classList.add(
        "message-name"
    );

    name.textContent =
        sender === "user"
            ? "You"
            : "AI Assistant";


    const text =
        document.createElement("div");

    text.classList.add(
        "message-text"
    );

    text.textContent = message;


    content.appendChild(name);

    content.appendChild(text);

    messageDiv.appendChild(avatar);

    messageDiv.appendChild(content);

    chatBox.appendChild(messageDiv);


    chatBox.scrollTop =
        chatBox.scrollHeight;
}


// ============================================================
// TYPING INDICATOR
// ============================================================

function showTyping() {

    const typing =
        document.createElement("div");

    typing.id =
        "typingIndicator";

    typing.classList.add(
        "message",
        "bot-message",
        "typing-message"
    );


    typing.innerHTML = `
        <div class="message-avatar">
            🤖
        </div>

        <div class="message-content">

            <div class="message-name">
                AI Assistant
            </div>

            <div class="typing-dots">

                <span></span>
                <span></span>
                <span></span>

            </div>

        </div>
    `;


    chatBox.appendChild(typing);

    chatBox.scrollTop =
        chatBox.scrollHeight;
}


function hideTyping() {

    const typing =
        document.getElementById(
            "typingIndicator"
        );

    if (typing) {
        typing.remove();
    }
}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {

    const message =
        messageInput.value.trim();


    if (message === "") {
        return;
    }


    addMessage(
        message,
        "user"
    );


    messageInput.value = "";


    await sendToBackend(message);
}


// ============================================================
// SEND TEXT TO GRADIO BACKEND
// ============================================================

async function sendToBackend(message) {

    sendButton.disabled = true;

    messageInput.disabled = true;

    showTyping();

    statusText.textContent =
        "Generating response...";


    try {

        const response =
            await fetch(
                `${HF_SPACE_URL}/gradio_api/call/chat`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        data: [message]
                    })
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const result =
            await response.json();


        const eventId =
            result.event_id;


        const eventResponse =
            await fetch(
                `${HF_SPACE_URL}/gradio_api/call/chat/${eventId}`
            );


        if (!eventResponse.ok) {

            throw new Error(
                `HTTP ${eventResponse.status}`
            );
        }


        const reader =
            eventResponse.body.getReader();

        const decoder =
            new TextDecoder();

        let buffer = "";

        let botResponse = "";


        while (true) {

            const {
                value,
                done
            } = await reader.read();


            if (done) {
                break;
            }


            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );


            const lines =
                buffer.split("\n");

            buffer =
                lines.pop();


            for (const line of lines) {

                if (
                    line.startsWith("data:")
                ) {

                    const data =
                        line
                            .substring(5)
                            .trim();


                    if (
                        data === "[DONE]"
                    ) {
                        continue;
                    }


                    try {

                        const parsed =
                            JSON.parse(data);


                        if (
                            Array.isArray(parsed) &&
                            parsed.length > 0
                        ) {

                            botResponse =
                                parsed[0];
                        }

                    }
                    catch (error) {

                        console.log(
                            "Parsing:",
                            data
                        );
                    }
                }
            }
        }


        hideTyping();


        if (botResponse) {

            addMessage(
                botResponse,
                "bot"
            );

        }
        else {

            addMessage(
                "Sorry, I received an empty response.",
                "bot"
            );
        }


        statusText.textContent =
            "Ready";

    }
    catch (error) {

        console.error(
            "Chat error:",
            error
        );


        hideTyping();


        addMessage(
            "Sorry, I could not connect to the chatbot.",
            "bot"
        );


        statusText.textContent =
            "Connection error";
    }


    sendButton.disabled = false;

    messageInput.disabled = false;

    messageInput.focus();
}


// ============================================================
// ENTER KEY
// ============================================================

messageInput.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }

    }
);


// ============================================================
// SEND BUTTON
// ============================================================

sendButton.addEventListener(
    "click",
    sendMessage
);


// ============================================================
// MICROPHONE BUTTON
// ============================================================

micButton.addEventListener(
    "click",
    function() {

        if (isRecording) {

            stopRecording();

        }
        else {

            startRecording();

        }

    }
);


// ============================================================
// START RECORDING
// ============================================================

async function startRecording() {

    try {

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });


        mediaRecorder =
            new MediaRecorder(stream);


        audioChunks = [];

        isRecording = true;


        mediaRecorder.ondataavailable =
            function(event) {

                if (
                    event.data.size > 0
                ) {

                    audioChunks.push(
                        event.data
                    );
                }

            };


        mediaRecorder.onstop =
            async function() {

                const audioBlob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                "audio/webm"
                        }
                    );


                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );


                await sendAudioToBackend(
                    audioBlob
                );

            };


        mediaRecorder.start();


        micButton.classList.add(
            "recording"
        );


        micButton.textContent =
            "⏹️";


        micButton.title =
            "Stop recording";


        statusText.textContent =
            "Recording... Click ⏹️ to stop";


        recordingTimer =
            setTimeout(
                function() {

                    stopRecording();

                },
                5000
            );

    }
    catch (error) {

        console.error(
            "Microphone error:",
            error
        );


        statusText.textContent =
            "Microphone permission denied.";


        alert(
            "Please allow microphone access."
        );
    }
}


// ============================================================
// STOP RECORDING
// ============================================================

function stopRecording() {

    if (recordingTimer) {

        clearTimeout(
            recordingTimer
        );

        recordingTimer = null;
    }


    if (
        mediaRecorder &&
        mediaRecorder.state === "recording"
    ) {

        mediaRecorder.stop();
    }


    isRecording = false;


    micButton.classList.remove(
        "recording"
    );


    micButton.textContent =
        "🎤";


    micButton.title =
        "Start recording";


    statusText.textContent =
        "Processing audio...";
}


// ============================================================
// SEND AUDIO TO GRADIO
// ============================================================

async function sendAudioToBackend(
    audioBlob
) {

    try {

        const formData =
            new FormData();


        formData.append(
            "files",
            audioBlob,
            "recording.webm"
        );


        const uploadResponse =
            await fetch(
                `${HF_SPACE_URL}/gradio_api/upload`,
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!uploadResponse.ok) {

            throw new Error(
                `Upload failed: HTTP ${uploadResponse.status}`
            );
        }


        const uploaded =
            await uploadResponse.json();


        const filePath =
            Array.isArray(uploaded)
                ? uploaded[0]
                : uploaded;


        const response =
            await fetch(
                `${HF_SPACE_URL}/gradio_api/call/speech`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        data: [
                            {
                                path: filePath
                            }
                        ]
                    })
                }
            );


        if (!response.ok) {

            throw new Error(
                `Speech request failed: HTTP ${response.status}`
            );
        }


        const result =
            await response.json();


        const eventId =
            result.event_id;


        const eventResponse =
            await fetch(
                `${HF_SPACE_URL}/gradio_api/call/speech/${eventId}`
            );


        if (!eventResponse.ok) {

            throw new Error(
                `Speech result failed: HTTP ${eventResponse.status}`
            );
        }


        const reader =
            eventResponse.body.getReader();

        const decoder =
            new TextDecoder();

        let buffer = "";

        let recognizedText = "";


        while (true) {

            const {
                value,
                done
            } = await reader.read();


            if (done) {
                break;
            }


            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );


            const lines =
                buffer.split("\n");

            buffer =
                lines.pop();


            for (const line of lines) {

                if (
                    line.startsWith("data:")
                ) {

                    const data =
                        line
                            .substring(5)
                            .trim();


                    if (
                        data === "[DONE]"
                    ) {
                        continue;
                    }


                    try {

                        const parsed =
                            JSON.parse(data);


                        if (
                            Array.isArray(parsed) &&
                            parsed.length > 0
                        ) {

                            recognizedText =
                                parsed[0];
                        }

                    }
                    catch (error) {

                        console.log(
                            "Speech parsing:",
                            data
                        );
                    }
                }
            }
        }


        if (
            recognizedText &&
            recognizedText.trim() !== ""
        ) {

            addMessage(
                recognizedText,
                "user"
            );


            await sendToBackend(
                recognizedText
            );

        }
        else {

            addMessage(
                "I could not understand the audio.",
                "bot"
            );


            statusText.textContent =
                "Ready";
        }

    }
    catch (error) {

        console.error(
            "Speech error:",
            error
        );


        addMessage(
            "Could not process the audio.",
            "bot"
        );


        statusText.textContent =
            "Ready";
    }
}

