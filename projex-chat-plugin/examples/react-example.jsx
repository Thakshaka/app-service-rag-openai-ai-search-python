import React, { useEffect, useRef, useState } from 'react';

/**
 * ProjeX Chat Plugin - React Example
 * 
 * This example shows how to use the ProjeX Chat Web Component in a React application.
 */

// Import the Web Component (make sure it's bundled or loaded via script tag)
import '../src/projex-chat.js';

function App() {
  const chatRef = useRef(null);
  const [eventLog, setEventLog] = useState([]);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const chat = chatRef.current;
    if (!chat) return;

    // Event listeners
    const handleMessageSent = (e) => {
      addLog(`User: ${e.detail.message}`);
      setMessageCount(prev => prev + 1);
    };

    const handleResponseReceived = (e) => {
      addLog(`AI: ${e.detail.response.content.substring(0, 50)}...`);
    };

    const handleError = (e) => {
      addLog(`Error: ${e.detail.error}`, 'error');
    };

    const handleChatOpened = () => {
      addLog('Chat opened');
    };

    const handleChatClosed = () => {
      addLog('Chat closed');
    };

    chat.addEventListener('message-sent', handleMessageSent);
    chat.addEventListener('response-received', handleResponseReceived);
    chat.addEventListener('error', handleError);
    chat.addEventListener('chat-opened', handleChatOpened);
    chat.addEventListener('chat-closed', handleChatClosed);

    // Cleanup
    return () => {
      chat.removeEventListener('message-sent', handleMessageSent);
      chat.removeEventListener('response-received', handleResponseReceived);
      chat.removeEventListener('error', handleError);
      chat.removeEventListener('chat-opened', handleChatOpened);
      chat.removeEventListener('chat-closed', handleChatClosed);
    };
  }, []);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLog(prev => [...prev, { timestamp, message, type }]);
  };

  const handleOpenChat = () => {
    chatRef.current?.open();
  };

  const handleCloseChat = () => {
    chatRef.current?.close();
  };

  const handleToggleChat = () => {
    chatRef.current?.toggle();
  };

  const handleSendMessage = () => {
    chatRef.current?.sendMessage("Tell me about ProjeX");
  };

  const handleClearHistory = () => {
    chatRef.current?.clearHistory();
    addLog('History cleared');
  };

  const handleGetHistory = () => {
    const history = chatRef.current?.getHistory();
    console.log('Chat history:', history);
    addLog(`Retrieved ${history?.length || 0} messages`);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>ProjeX Chat Plugin</h1>
        <p>React Integration Example</p>
      </header>

      <div style={styles.content}>
        <section style={styles.section}>
          <h2>1. Basic Usage</h2>
          <p>Simply add the custom element to your JSX:</p>
          <pre style={styles.code}>
{`import 'projex-chat-plugin';

function App() {
  return (
    <projex-chat 
      api-url="https://your-api.vercel.app"
    />
  );
}`}
          </pre>
        </section>

        <section style={styles.section}>
          <h2>2. Programmatic Control</h2>
          <p>Use a ref to access the Web Component's methods:</p>
          
          <div style={styles.controls}>
            <button onClick={handleOpenChat} style={styles.button}>
              Open Chat
            </button>
            <button onClick={handleCloseChat} style={styles.button}>
              Close Chat
            </button>
            <button onClick={handleToggleChat} style={styles.button}>
              Toggle Chat
            </button>
            <button onClick={handleSendMessage} style={styles.button}>
              Send Message
            </button>
            <button onClick={handleClearHistory} style={styles.button}>
              Clear History
            </button>
            <button onClick={handleGetHistory} style={styles.button}>
              Get History
            </button>
          </div>

          <pre style={styles.code}>
{`const chatRef = useRef(null);

// Control methods
chatRef.current?.open();
chatRef.current?.close();
chatRef.current?.sendMessage("Hello");
chatRef.current?.clearHistory();
const history = chatRef.current?.getHistory();`}
          </pre>
        </section>

        <section style={styles.section}>
          <h2>3. Event Listeners</h2>
          <p>Listen to chat events in useEffect:</p>
          
          <div style={styles.stats}>
            <div>Messages sent: {messageCount}</div>
            <div>Total events: {eventLog.length}</div>
          </div>

          <div style={styles.eventLog}>
            {eventLog.length === 0 ? (
              <div>Waiting for events...</div>
            ) : (
              eventLog.map((log, index) => (
                <div 
                  key={index} 
                  style={{
                    ...styles.logEntry,
                    color: log.type === 'error' ? '#ff6b6b' : '#00ff00'
                  }}
                >
                  [{log.timestamp}] {log.message}
                </div>
              ))
            )}
          </div>

          <pre style={styles.code}>
{`useEffect(() => {
  const chat = chatRef.current;
  
  const handleMessageSent = (e) => {
    console.log('User:', e.detail.message);
  };
  
  chat.addEventListener('message-sent', handleMessageSent);
  
  return () => {
    chat.removeEventListener('message-sent', handleMessageSent);
  };
}, []);`}
          </pre>
        </section>

        <section style={styles.section}>
          <h2>4. TypeScript Support</h2>
          <p>Add type definitions for better DX:</p>
          <pre style={styles.code}>
{`// projex-chat.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    'projex-chat': {
      ref?: React.Ref<ProjeXChatElement>;
      'api-url': string;
      theme?: 'light' | 'dark';
      title?: string;
      placeholder?: string;
      'quick-questions'?: string;
      open?: boolean;
    };
  }
}

interface ProjeXChatElement extends HTMLElement {
  open(): void;
  close(): void;
  toggle(): void;
  sendMessage(text: string): Promise<void>;
  clearHistory(): void;
  getHistory(): Array<{role: string; content: string}>;
}`}
          </pre>
        </section>
      </div>

      {/* The actual chat widget */}
      <projex-chat
        ref={chatRef}
        api-url="http://localhost:8080"
        title="ProjeX Assistant (React Demo)"
        placeholder="Ask me anything about ProjeX..."
        quick-questions='["About ProjeX", "Our Solutions", "Project Setup"]'
      />
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
    background: '#f5f5f5',
  },
  header: {
    marginBottom: '40px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  section: {
    background: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  code: {
    background: '#f8f9fa',
    padding: '16px',
    borderRadius: '8px',
    overflow: 'auto',
    fontSize: '14px',
    fontFamily: 'monospace',
  },
  controls: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  button: {
    padding: '10px 20px',
    background: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  stats: {
    display: 'flex',
    gap: '20px',
    marginBottom: '16px',
    fontSize: '14px',
    color: '#666',
  },
  eventLog: {
    background: '#1e1e1e',
    color: '#00ff00',
    padding: '16px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
    maxHeight: '200px',
    overflowY: 'auto',
    marginBottom: '16px',
  },
  logEntry: {
    margin: '4px 0',
  },
};

export default App;
