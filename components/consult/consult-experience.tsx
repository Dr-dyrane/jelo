'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo, useState } from 'react';

const prompts = ['Tiny bumps on my forehead', 'Dark marks after acne', 'My face is oily and sensitive'];

export function ConsultExperience() {
  const [input, setInput] = useState('');
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/consult' }), []);
  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === 'streaming' || status === 'submitted';

  function submit(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    sendMessage({ text: value });
    setInput('');
  }

  return (
    <section className="consult-card">
      <div className="chat-stream" aria-live="polite">
        {messages.length === 0 ? (
          <div className="consult-empty">
            <p>Tell us what you notice, where it is and how long it has been there.</p>
            <div className="prompt-row">
              {prompts.map(prompt => <button key={prompt} type="button" onClick={() => submit(prompt)}>{prompt}</button>)}
            </div>
          </div>
        ) : messages.map(message => (
          <article key={message.id} className={`message ${message.role}`}>
            <span>{message.role === 'user' ? 'You' : 'JeloCare'}</span>
            {message.parts.map((part, index) => part.type === 'text' ? <p key={index}>{part.text}</p> : null)}
          </article>
        ))}
        {error ? <p className="consult-error">The consultation could not continue. Please try again.</p> : null}
      </div>
      <form className="consult-form" onSubmit={event => { event.preventDefault(); submit(input); }}>
        <textarea value={input} onChange={event => setInput(event.target.value)} placeholder="Describe your concern…" rows={3} aria-label="Describe your skin concern" />
        <button type="submit" disabled={!input.trim() || busy}>{busy ? 'Thinking…' : 'Send'}</button>
      </form>
      <p className="consult-note">Urgent, painful or rapidly worsening symptoms need in-person care.</p>
    </section>
  );
}
