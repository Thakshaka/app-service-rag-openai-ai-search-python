/**
 * ProjeX Chat Plugin - Web Component
 * A reusable chat widget that can be dropped into any frontend
 * 
 * Usage:
 * <projex-chat api-url="https://your-api-domain.com"></projex-chat>
 */

class ProjeXChat extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.messages = [];
        this.isOpen = false;
        this.isLoading = false;
    }

    static get observedAttributes() {
        return ['api-url', 'theme', 'position', 'title', 'placeholder', 'quick-questions', 'open', 'welcome-message', 'suggestions', 'show-citations', 'index-name', 'system-prompt'];
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        
        // Auto-open if attribute is set
        if (this.hasAttribute('open')) {
            this.open();
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.render();
        }
    }

    // Public API
    open() {
        this.isOpen = true;
        this.shadowRoot.querySelector('.chat-container')?.classList.add('open');
        this.dispatchEvent(new CustomEvent('chat-opened'));
    }

    close() {
        this.isOpen = false;
        this.shadowRoot.querySelector('.chat-container')?.classList.remove('open');
        this.dispatchEvent(new CustomEvent('chat-closed'));
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    async sendMessage(content = null) {
        const input = this.shadowRoot.querySelector('.chat-input');
        const message = content || input?.value.trim();
        
        if (!message) return;
        
        // Clear input
        if (input && !content) input.value = '';
        
        // Add user message
        this.messages.push({ role: 'user', content: message });
        this.updateMessages();
        
        // Show loading
        this.isLoading = true;
        this.showLoading(); // Changed from updateLoadingState() to match existing methods
        
        try {
            const apiUrl = this.getAttribute('api-url');
            if (!apiUrl) {
                throw new Error('API URL not configured');
            }
            
            // Get index name if specified
            const indexName = this.getAttribute('index-name');
            
            // Get system prompt if specified
            const systemPrompt = this.getAttribute('system-prompt');
            
            // Prepare request payload
            const payload = {
                messages: this.messages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            };
            
            // Add index_name if specified
            if (indexName) {
                payload.index_name = indexName;
            }
            
            // Add system_prompt if specified
            if (systemPrompt) {
                payload.system_prompt = systemPrompt;
            }
            
            const response = await fetch(`${apiUrl}/api/chat/completion`, { // Reverted endpoint to original
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' // Reverted header to original
                },
                mode: 'cors', // Reverted mode to original
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text(); // Reverted error handling to original
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            // Handle different response formats
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from server');
            }
            
            // Get the assistant message content
            let messageContent = data.choices[0].message.content;
            
            // Check if citations should be shown
            const showCitations = this.getAttribute('show-citations') !== 'false';
            
            // If citations are disabled, strip citation text from the response
            if (!showCitations) {
                // Remove [filename.md], [doc1], etc. from the text
                messageContent = messageContent.replace(/\[([^\]]+\.(md|txt|pdf|docx?))\]/gi, '');
                messageContent = messageContent.replace(/\[doc\d+\]/g, '');
                // Clean up any double spaces left behind
                messageContent = messageContent.replace(/\s{2,}/g, ' ').trim();
            }
            
            const assistantMessage = {
                role: 'assistant',
                content: messageContent,
                citations: data.choices[0].message.context?.citations || []
            };
            
            // Add assistant response
            this.messages.push(assistantMessage);
            this.updateMessages();

            this.dispatchEvent(new CustomEvent('response-received', { 
                detail: { response: assistantMessage } 
            }));
            
        } catch (error) {
            console.error('Chat error:', error);
            
            // Provide user-friendly error messages
            let errorMessage = 'An error occurred. Please try again.';
            
            if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Cannot connect to the server. Please check:\n1. Is your backend running?\n2. Is the API URL correct?\n3. Are you running this from a web server (not file://)?';
            } else if (error.message.includes('CORS')) {
                errorMessage = 'CORS error. Please enable CORS on your backend server.';
            } else if (error.message.includes('API URL not configured')) {
                errorMessage = error.message;
            } else {
                errorMessage = error.message;
            }
            
            this.showError(errorMessage);
            
            this.dispatchEvent(new CustomEvent('error', { 
                detail: { error: errorMessage } 
            }));
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    clearHistory() {
        this.messages = [];
        this.updateMessages();
        this.dispatchEvent(new CustomEvent('history-cleared'));
    }

    getHistory() {
        return [...this.messages];
    }

    // Internal methods
    setupEventListeners() {
        const shadow = this.shadowRoot;
        
        // Toggle button
        shadow.querySelector('.chat-toggle')?.addEventListener('click', () => {
            this.toggle();
        });

        // Close button
        shadow.querySelector('.close-btn')?.addEventListener('click', () => {
            this.close();
        });

        // Form submission
        const form = shadow.querySelector('.chat-form');
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = shadow.querySelector('.chat-input');
            const text = input.value.trim();
            if (text) {
                this.sendMessage(text);
                input.value = '';
            }
        });

        // Quick questions
        shadow.querySelectorAll('.quick-question-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.sendMessage(btn.textContent);
            });
        });

        // Suggestion buttons (welcome view)
        shadow.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.sendMessage(btn.textContent);
            });
        });

        // Citation clicks
        shadow.addEventListener('click', (e) => {
            if (e.target.classList.contains('citation-badge')) {
                const index = e.target.dataset.index;
                const messageId = e.target.dataset.messageId;
                this.showCitation(messageId, index);
            }
            
            // Close citation panel
            if (e.target.classList.contains('citation-close-btn')) {
                this.closeCitation();
            }
        });
    }

    showLoading() {
        const loading = this.shadowRoot.querySelector('.loading-indicator');
        if (loading) loading.style.display = 'flex';
    }

    hideLoading() {
        const loading = this.shadowRoot.querySelector('.loading-indicator');
        if (loading) loading.style.display = 'none';
    }

    showError(message) {
        const errorDiv = this.shadowRoot.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }

    showCitation(messageId, index) {
        const message = this.messages[messageId];
        if (message && message.citations && message.citations[index - 1]) {
            const citation = message.citations[index - 1];
            
            // Dispatch event for custom citation handling
            this.dispatchEvent(new CustomEvent('citation-clicked', { 
                detail: { citation } 
            }));
            
            // Show citation panel
            const citationPanel = this.shadowRoot.querySelector('.citation-panel');
            const citationTitle = this.shadowRoot.querySelector('.citation-title');
            const citationContent = this.shadowRoot.querySelector('.citation-content');
            
            if (citationPanel && citationTitle && citationContent) {
                citationTitle.textContent = `Citation ${index}: ${citation.title || citation.filePath || 'Document'}`;
                citationContent.textContent = citation.content || 'No content available';
                citationPanel.style.display = 'flex';
            }
        }
    }

    closeCitation() {
        const citationPanel = this.shadowRoot.querySelector('.citation-panel');
        if (citationPanel) {
            citationPanel.style.display = 'none';
        }
    }

    updateMessages() {
        const chatHistory = this.shadowRoot.querySelector('.chat-history');
        const welcomeView = this.shadowRoot.querySelector('.welcome-view');
        if (!chatHistory) return;

        // Show/hide welcome view based on message count
        if (this.messages.length === 0) {
            if (welcomeView) welcomeView.style.display = 'block';
            chatHistory.innerHTML = '';
            return;
        } else {
            if (welcomeView) welcomeView.style.display = 'none';
        }

        chatHistory.innerHTML = this.messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const content = this.renderMarkdown(msg.content, msg.citations, idx);
            const timestamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            
            if (isUser) {
                // User messages: right-aligned with light blue background
                return `
                    <div class="message user-message">
                        <div class="message-wrapper">
                            <div class="message-content">${content}</div>
                            <div class="message-time">${timestamp}</div>
                        </div>
                    </div>
                `;
            } else {
                // Assistant messages: left-aligned with avatar
                return `
                    <div class="message assistant-message">
                        <div class="message-avatar"></div>
                        <div class="message-wrapper">
                            <div class="message-content">${content}</div>
                            <div class="message-time">${timestamp}</div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        // Scroll to bottom
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    renderMarkdown(text, citations = [], messageId) {
        if (!text) return '';
        
        let html = text;
        
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        
        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        
        // Code
        html = html.replace(/`(.+?)`/g, '<code>$1</code>');
        
        // Lists
        html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\s*)+/g, (match) => '<ul>' + match + '</ul>');
        
        // Check if citations should be shown
        const showCitations = this.getAttribute('show-citations') !== 'false';
        
        // Citations - handle both [doc1] and [filename.md] formats
        if (showCitations && citations && citations.length > 0) {
            // [doc1] format
            html = html.replace(/\[doc(\d+)\]/g, (match, num) => {
                return `<span class="citation-badge" data-message-id="${messageId}" data-index="${num}">${num}</span>`;
            });
            
            // [filename.md] format
            const filenamePattern = /\[([^\]]+\.(md|txt|pdf|docx?))\]/gi;
            html = html.replace(filenamePattern, (match, filename) => {
                const citationIndex = citations.findIndex(c => 
                    c.filePath?.toLowerCase().includes(filename.toLowerCase()) ||
                    c.title?.toLowerCase().includes(filename.toLowerCase())
                );
                
                if (citationIndex !== -1) {
                    const idx = citationIndex + 1;
                    return `<span class="citation-badge" data-message-id="${messageId}" data-index="${idx}">${idx}</span>`;
                }
                return match;
            });
        }
        
        // Line breaks
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }

    render() {
        const theme = this.getAttribute('theme') || 'light';
        const position = this.getAttribute('position') || 'bottom-right';
        const title = this.getAttribute('title') || 'Help assistant';
        const placeholder = this.getAttribute('placeholder') || 'Write a message';
        const quickQuestions = JSON.parse(this.getAttribute('quick-questions') || '[]');
        const welcomeMessage = this.getAttribute('welcome-message') || 'Hi there. With the help of AI, I can answer questions or connect you to our team. Not sure where to start? You can try:';
        const suggestions = JSON.parse(this.getAttribute('suggestions') || '["What is ProjeX?", "How do I start a project?"]');

        this.shadowRoot.innerHTML = `
            <style>${this.getStyles()}</style>
            
            <div class="chat-container ${theme} ${position}">
                <div class="chat-header">
                    <div class="header-content">
                        <div class="avatar-container">
                            <div class="avatar-img"></div>
                            <span class="status-indicator"></span>
                        </div>
                        <div class="header-text">
                            <h3>${title}</h3>
                            <span class="status-text">Active</span>
                        </div>
                    </div>
                    <button class="close-btn" aria-label="Close chat">×</button>
                </div>
                
                <div class="chat-body">
                    <div class="disclaimer">
                        This AI-powered chat may make mistakes. <a href="#" class="learn-more">Learn more</a>
                    </div>
                    
                    <div class="welcome-view">
                        <div class="welcome-message-bubble">
                            <div class="message-content">${welcomeMessage}</div>
                        </div>
                        <div class="welcome-suggestions">
                            ${suggestions.map(s => `
                                <div class="suggestion-bubble">
                                    <button class="suggestion-btn">${s}</button>
                                </div>
                            `).join('')}
                        </div>
                        <div class="welcome-footer">
                            <div class="welcome-avatar"></div>
                            <div class="welcome-time">${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                        </div>
                    </div>
                    
                    <div class="chat-history"></div>
                    
                    <div class="loading-indicator" style="display: none;">
                        <span></span><span></span><span></span>
                    </div>
                    
                    <div class="error-message" style="display: none;"></div>
                </div>
                
                <div class="citation-panel" style="display: none;">
                    <div class="citation-content-wrapper">
                        <div class="citation-header">
                            <h4 class="citation-title">Citation</h4>
                            <button class="citation-close-btn" aria-label="Close citation">×</button>
                        </div>
                        <div class="citation-body">
                            <p class="citation-content"></p>
                        </div>
                    </div>
                </div>
                
                <div class="chat-footer">
                    ${quickQuestions.length > 0 ? `
                        <div class="quick-questions">
                            ${quickQuestions.map(q => `
                                <button class="quick-question-btn">${q}</button>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <form class="chat-form">
                        <input 
                            type="text" 
                            class="chat-input" 
                            placeholder="${placeholder}"
                            autocomplete="off"
                        />
                        <button type="submit" class="send-btn" aria-label="Send message">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
            
            <button class="chat-toggle" aria-label="Open chat">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
            </button>
        `;
    }

    getStyles() {
        return `
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            :host {
                --primary-color: #2977C9;
                --header-bg: #2977C9;
                --background: #ffffff;
                --text-color: #333333;
                --border-color: #e0e0e0;
                --user-message-bg: #D0E7F9;
                --assistant-message-bg: #F3F3F3;
                --disclaimer-bg: #F3F6F8;
                --disclaimer-text: #666666;
                --timestamp-color: #999999;
                --border-radius: 8px;
                --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                --max-width: 410px;
                --max-height: 600px;
            }

            .chat-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: var(--primary-color);
                color: white;
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
                z-index: 999;
            }

            .chat-toggle:hover {
                transform: scale(1.1);
            }

            .chat-container {
                position: fixed;
                bottom: 90px;
                right: 20px;
                width: var(--max-width);
                height: var(--max-height);
                background: var(--background);
                border-radius: 0;
                box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                display: none;
                flex-direction: column;
                font-family: var(--font-family);
                z-index: 1000;
                overflow: hidden;
            }

            .chat-container.open {
                display: flex;
            }

            .chat-container.bottom-left {
                right: auto;
                left: 20px;
            }

            .chat-container.inline {
                position: relative;
                bottom: auto;
                right: auto;
                display: flex;
            }

            /* Header */
            .chat-header {
                background: var(--header-bg);
                color: white;
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .header-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .avatar-container {
                position: relative;
                width: 40px;
                height: 40px;
            }

            .avatar-img {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(135deg, #D4A574 0%, #C89860 100%);
                border: 2px solid white;
            }

            .status-indicator {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 12px;
                height: 12px;
                background: #57D9A3;
                border: 2px solid var(--header-bg);
                border-radius: 50%;
            }

            .header-text {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .header-text h3 {
                font-size: 16px;
                font-weight: 600;
                line-height: 1.2;
            }

            .status-text {
                font-size: 12px;
                opacity: 0.9;
                font-weight: 400;
            }

            .close-btn {
                background: transparent;
                border: none;
                color: white;
                font-size: 28px;
                cursor: pointer;
                line-height: 1;
                padding: 0;
                width: 30px;
                height: 30px;
                opacity: 0.9;
            }

            .close-btn:hover {
                opacity: 1;
            }

            /* Body */
            .chat-body {
                flex: 1;
                overflow-y: auto;
                padding: 0;
                background: white;
                display: flex;
                flex-direction: column;
            }

            .disclaimer {
                background: var(--disclaimer-bg);
                color: var(--disclaimer-text);
                padding: 12px 16px;
                font-size: 12px;
                line-height: 1.4;
                border-bottom: 1px solid #E8EBED;
            }

            .disclaimer .learn-more {
                color: var(--primary-color);
                text-decoration: none;
            }

            .disclaimer .learn-more:hover {
                text-decoration: underline;
            }

            /* Welcome View */
            .welcome-view {
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .welcome-message-bubble {
                display: flex;
                gap: 8px;
                align-items: flex-start;
            }

            .welcome-message-bubble .message-content {
                background: var(--assistant-message-bg);
                padding: 10px 14px;
                border-radius: 12px 12px 12px 0;
                color: #666666;
                font-size: 14px;
                line-height: 1.6;
                max-width: 85%;
            }

            .welcome-suggestions {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding-left: 0;
            }

            .suggestion-bubble {
                display: flex;
                gap: 8px;
                align-items: flex-start;
            }

            .suggestion-btn {
                background: var(--assistant-message-bg);
                border: none;
                color: var(--primary-color);
                text-align: left;
                padding: 10px 14px;
                font-size: 14px;
                cursor: pointer;
                transition: opacity 0.2s;
                line-height: 1.5;
                border-radius: 12px 12px 12px 0;
                width: fit-content;
                max-width: 85%;
            }

            .suggestion-btn:hover {
                opacity: 0.7;
            }

            .welcome-footer {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .welcome-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: linear-gradient(135deg, #D4A574 0%, #C89860 100%);
            }

            .welcome-time {
                font-size: 11px;
                color: var(--timestamp-color);
            }

            .chat-history {
                flex: 1;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                overflow-y: auto;
            }

            /* Messages */
            .message {
                display: flex;
                gap: 8px;
                align-items: flex-start;
            }

            .user-message {
                justify-content: flex-end;
            }

            .assistant-message {
                justify-content: flex-start;
            }

            .message-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: linear-gradient(135deg, #D4A574 0%, #C89860 100%);
                flex-shrink: 0;
            }

            .message-wrapper {
                display: flex;
                flex-direction: column;
                gap: 4px;
                max-width: 75%;
            }

            .message-content {
                padding: 10px 14px;
                border-radius: var(--border-radius);
                word-wrap: break-word;
                line-height: 1.5;
                font-size: 14px;
                color: #333333;
            }

            .user-message .message-content {
                background: var(--user-message-bg);
                border-radius: 12px 12px 0 12px;
            }

            .assistant-message .message-content {
                background: var(--assistant-message-bg);
                border-radius: 12px 12px 12px 0;
            }

            .message-time {
                font-size: 11px;
                color: var(--timestamp-color);
                padding: 0 4px;
            }

            .user-message .message-time {
                text-align: right;
            }

            .assistant-message .message-time {
                text-align: left;
            }

            .message-content ul {
                margin: 8px 0;
                padding-left: 20px;
            }

            .message-content li {
                margin: 4px 0;
            }

            .message-content strong {
                font-weight: 600;
            }

            .message-content code {
                background: rgba(0,0,0,0.05);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.9em;
            }

            .citation-badge {
                display: inline-block;
                background: var(--primary-color);
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 12px;
                cursor: pointer;
                margin: 0 2px;
            }

            .citation-badge:hover {
                opacity: 0.8;
            }

            /* Citation Panel */
            .citation-panel {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 100;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }

            .citation-content-wrapper {
                background: white;
                border-radius: 8px;
                max-width: 90%;
                max-height: 80%;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }

            .citation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border-bottom: 1px solid var(--border-color);
            }

            .citation-title {
                font-size: 16px;
                font-weight: 600;
                color: #333333;
                margin: 0;
            }

            .citation-close-btn {
                background: transparent;
                border: none;
                color: #666666;
                font-size: 28px;
                cursor: pointer;
                line-height: 1;
                padding: 0;
                width: 30px;
                height: 30px;
            }

            .citation-close-btn:hover {
                color: #333333;
            }

            .citation-body {
                padding: 16px;
                overflow-y: auto;
                flex: 1;
            }

            .citation-content {
                font-size: 14px;
                line-height: 1.6;
                color: #333333;
                white-space: pre-wrap;
                word-wrap: break-word;
            }

            .loading-indicator {
                display: flex;
                gap: 4px;
                padding: 8px 16px;
                justify-content: flex-start;
            }

            .loading-indicator span {
                width: 8px;
                height: 8px;
                background: #999999;
                border-radius: 50%;
                animation: bounce 1.4s infinite ease-in-out both;
            }

            .loading-indicator span:nth-child(1) { animation-delay: -0.32s; }
            .loading-indicator span:nth-child(2) { animation-delay: -0.16s; }

            @keyframes bounce {
                0%, 80%, 100% { transform: scale(0.6); opacity: 0.6; }
                40% { transform: scale(1.0); opacity: 1; }
            }

            .error-message {
                background: #ffebee;
                color: #c62828;
                padding: 12px 16px;
                font-size: 13px;
                margin: 8px 16px;
                border-radius: 8px;
            }

            /* Footer */
            .chat-footer {
                border-top: 1px solid var(--border-color);
                background: white;
                padding: 12px 16px;
            }

            .quick-questions {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
                flex-wrap: wrap;
            }

            .quick-question-btn {
                background: transparent;
                border: 1px solid var(--primary-color);
                color: var(--primary-color);
                padding: 6px 12px;
                border-radius: 16px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .quick-question-btn:hover {
                background: var(--primary-color);
                color: white;
            }

            .chat-form {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .chat-input {
                flex: 1;
                padding: 10px 14px;
                border: 1px solid #D0D0D0;
                border-radius: 4px;
                font-size: 14px;
                font-family: inherit;
                outline: none;
                color: #333333;
            }

            .chat-input::placeholder {
                color: #999999;
            }

            .chat-input:focus {
                border-color: var(--primary-color);
            }

            .send-btn {
                background: transparent;
                color: #999999;
                border: none;
                width: 36px;
                height: 36px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s;
                padding: 0;
            }

            .send-btn:hover {
                color: var(--primary-color);
            }

            /* Dark theme */
            .chat-container.dark {
                --background: #1e1e1e;
                --text-color: #ffffff;
                --border-color: #333333;
                --user-message-bg: #1a237e;
                --assistant-message-bg: #2a2a2a;
                --disclaimer-bg: #2a2a2a;
                --disclaimer-text: #cccccc;
            }

            .chat-container.dark .chat-body {
                background: #1e1e1e;
            }

            .chat-container.dark .message-content {
                color: white;
            }

            .chat-container.dark .chat-input {
                background: #333333;
                color: white;
                border-color: #444444;
            }

            .chat-container.dark .chat-footer {
                background: #1e1e1e;
            }

            /* Mobile responsive */
            @media (max-width: 480px) {
                .chat-container {
                    width: 100%;
                    height: 100%;
                    bottom: 0;
                    right: 0;
                    border-radius: 0;
                }

                .chat-toggle {
                    bottom: 16px;
                    right: 16px;
                }
            }

            /* Scrollbar styling */
            .chat-history::-webkit-scrollbar {
                width: 6px;
            }

            .chat-history::-webkit-scrollbar-track {
                background: #f1f1f1;
            }

            .chat-history::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 3px;
            }

            .chat-history::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
        `;
    }
}

// Register the custom element
customElements.define('projex-chat', ProjeXChat);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjeXChat;
}
