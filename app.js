/**
 * Deeps AI Chatbot Interface Logic
 * Features: Sidebar history, persistent storage, image generation triggers,
 * PDF RAG integration with backend support.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Icons
    const initIcons = () => {
        if (window.lucide) {
            lucide.createIcons();
        }
    };
    initIcons();

    // 2. DOM Elements
    const chatInput = document.getElementById('chat-input');
    const submitBtn = document.getElementById('submit-btn');
    const responseContainer = document.getElementById('response-container');
    const responseText = document.getElementById('response-text');
    const copyBtn = document.getElementById('copy-btn');
    const newThreadBtn = document.getElementById('new-thread-btn');
    const historyList = document.getElementById('history-list');
    
    // File upload elements
    const computerChip = document.getElementById('computer-chip');
    const pdfUpload = document.getElementById('pdf-upload');
    const fileStatus = document.getElementById('file-status');

    // 3. State Management
    let chatHistory = JSON.parse(localStorage.getItem('deeps_history')) || [];
    let isFileActive = false;

    /**
     * PDF Upload Logic
     */
    computerChip.addEventListener('click', () => {
        pdfUpload.click();
    });

    pdfUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        fileStatus.textContent = "Uploading...";
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:5000/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                fileStatus.textContent = file.name.substring(0, 10) + "...";
                isFileActive = true;
                computerChip.classList.add('active-chip');
                alert(`File "${file.name}" indexed successfully! Deeps AI is now using it as context.`);
            } else {
                fileStatus.textContent = "Error";
                alert(`Upload failed: ${data.error}`);
            }
        } catch (error) {
            console.error('File upload error:', error);
            fileStatus.textContent = "Failed";
        }
    });

    /**
     * Render Sidebar History
     */
    const renderHistory = () => {
        historyList.innerHTML = '';
        chatHistory.slice().reverse().forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.textContent = item.title;
            div.onclick = () => loadThread(chatHistory.length - 1 - index);
            historyList.appendChild(div);
        });
    };

    const saveToHistory = (title, content, isImage = false) => {
        chatHistory.push({ title, content, isImage, date: new Date().toISOString() });
        localStorage.setItem('deeps_history', JSON.stringify(chatHistory));
        renderHistory();
    };

    const loadThread = (index) => {
        const thread = chatHistory[index];
        responseContainer.classList.remove('hidden');
        if (thread.isImage) {
            responseText.innerHTML = `<div class="image-result-card">
                <img src="${thread.content}" alt="Generated artwork">
                <p>Generated based on: "${thread.title}"</p>
            </div>`;
        } else {
            responseText.innerHTML = window.marked ? marked.parse(thread.content) : thread.content;
        }
    };

    // 4. Input Logic
    const autoResize = (target) => {
        target.style.height = 'auto';
        target.style.height = target.scrollHeight + 'px';
    };

    chatInput.addEventListener('input', (e) => {
        autoResize(e.target);
        const hasText = e.target.value.trim().length > 0;
        submitBtn.disabled = !hasText;
        submitBtn.style.opacity = hasText ? '1' : '0.5';
    });

    /**
     * Visual/Image Generation Simulator
     */
    const generateImageMock = async (prompt) => {
        responseText.innerHTML = '<span class="loading-dots">Generating Visuals</span>';
        await new Promise(r => setTimeout(r, 2500));
        const imageUrl = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop`; 
        
        responseText.innerHTML = `<div class="image-result-card">
            <img src="${imageUrl}" alt="AI Generated Image" class="generated-img">
            <div class="img-meta">
                <span>Created with Deeps Visual Engine</span>
                <button class="download-btn" onclick="window.open('${imageUrl}')">Download</button>
            </div>
        </div>`;
        saveToHistory(prompt, imageUrl, true);
    };

    /**
     * Submit to Backend
     */
    const handleSubmission = async () => {
        const query = chatInput.value.trim();
        if (!query) return;

        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        chatInput.value = '';
        autoResize(chatInput);
        
        responseContainer.classList.remove('hidden');

        if (query.toLowerCase().includes('generate image') || query.toLowerCase().includes('create an image')) {
            await generateImageMock(query);
            return;
        }

        responseText.innerHTML = '<span class="loading-dots">Thinking</span>';

        try {
            const response = await fetch('http://localhost:5000/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: query }),
            });

            const data = await response.json();

            if (data.status === 'success') {
                responseText.innerHTML = window.marked ? marked.parse(data.response) : data.response;
                saveToHistory(query, data.response);
            } else {
                responseText.innerHTML = `<span style="color: #ef4444;">Error: ${data.error}</span>`;
            }
        } catch (error) {
            responseText.innerHTML = `<span style="color: #ef4444;">Error: Connection to Deeps AI backend lost.</span>`;
        } finally {
            initIcons();
        }
    };

    // Event Listeners
    submitBtn.addEventListener('click', handleSubmission);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmission();
        }
    });

    newThreadBtn.addEventListener('click', async () => {
        responseContainer.classList.add('hidden');
        chatInput.value = '';
        autoResize(chatInput);
        
        // Optionally clear PDF context on backend
        await fetch('http://localhost:5000/reset-context', { method: 'POST' });
        fileStatus.textContent = "Computer";
        computerChip.classList.remove('active-chip');
        isFileActive = false;
    });

    copyBtn.addEventListener('click', () => {
        const text = responseText.innerText;
        navigator.clipboard.writeText(text).then(() => alert('Copied!'));
    });

    renderHistory();
});
