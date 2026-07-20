'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export function ConsultExperience() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat();

  return (
    <section className="consult-card">
      <div className="chat-stream" aria-live="polite">
        {messages.length === 0 ? (
          <div className="consult-empty">
            <p>Start with what you notice, where it is and how long it has been there.</p>
            <div className="prompt-row">
              {['Tiny bumps on my forehead', 'Dark marks after acne', 'My face feels oily and sensitive'].map(prompt => (
                <button key={prompt} onClick={() => sendMessage({ text: prompt })}>{prompt}</button>
              ))}
            </div>
          </div>
        ) : messages.map(message => (
          <article key={message.id} className={`message ${message.role}`}>
            <span>{message.role === 'user' ? 'You' : 'JeloCare'}</span>
            {message.parts.map((part, index) => part.type === 'text' ? <p key={index}>{part.text}</p> : null)}
          </article>
        ))}
      </div>
      <form className="consult-form" onSubmit={event => {
        event.preventDefault();
        const value = input.trim();
        if (!value || status === 'streaming') return;
        sendMessage({ text: value });
        setInput('');
      }}>
        <textarea value={input} onChange={event => setInput(event.target.value)} placeholder="Describe your concern…" rows={3} />
        <button type="submit" disabled={!input.trim() || status === 'streaming'}>{status === 'streaming' ? 'Thinking…' : 'Send'}</button>
      </form>
    </section>
  );
}
