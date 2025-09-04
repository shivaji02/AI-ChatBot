import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import {fetchAI} from '../clientCalls';

type Message = { role: 'user' | 'assistant'; content: string };
type ChatProps = { getDoc: () => string; applyToEditor: (text: string) => void; model: string };
type Status = 'idle' | 'streaming';

function stripThinkBlocks(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export default function Chat({ getDoc, applyToEditor, model }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [sentSuggestions, setSentSuggestions] = useState<Set<string>>(new Set());

  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const statusRef = useRef<Status>('idle');               // latest status for stream closure
  const bufferRef = useRef<string>('');                   // accumulated text

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, status]);
  useEffect(() => { statusRef.current = status; }, [status]);

  const updateLastAssistant = useCallback((newContent: string) => {
    setMessages(prev => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') { copy[i] = { ...copy[i], content: newContent }; break; }
      }
      return copy;
    });
  }, []);

  // Disable send if suggestion already sent, regardless of editor content
  const isDupInEditor = useCallback((t: string) => sentSuggestions.has(t), [sentSuggestions]);

  const abortIfStreaming = useCallback(() => {
    if (statusRef.current === 'streaming') {
      abortRef.current?.abort();
      abortRef.current = null;
      setStatus('idle');                                    // instantly go back to Send
    }
  }, []);

  async function send() {
    const content = input.trim();
    if (!content || status !== 'idle') return;              // no-op if empty/busy

    // reset + enqueue
    setInput('');
    bufferRef.current = '';
    setMessages(m => [...m, { role: 'user', content }, { role: 'assistant', content: '__thinking__' }]);

    const ac = new AbortController();
    abortRef.current = ac;
    setStatus('streaming');

    try {
      await fetchAI({
        message: content,
        doc: getDoc(),
        model,
        onStream: (chunk: string) => {
          if (statusRef.current !== 'streaming') return;    // paused/aborted protection
          bufferRef.current += chunk;
          updateLastAssistant(stripThinkBlocks(bufferRef.current));
        }
      });

      if (!bufferRef.current) updateLastAssistant('[No response]');
    } catch (e: any) {
      // if aborted, keep silent; otherwise show error
      if (statusRef.current === 'streaming') {
        updateLastAssistant('Error: ' + (e?.message || 'request failed'));
      }
    } finally {
      abortRef.current = null;
      setStatus('idle');
    }
  }

  const handleApply = (text: string) => {
    abortIfStreaming();
    applyToEditor(text);
    setSentSuggestions(prev => new Set(prev).add(text));
  };

  return (
    <Aside>
      <Head>AI Chat</Head>

      <List ref={listRef}>
        {messages.map((m, i) => {
          if (m.role === 'assistant' && m.content === '__thinking__') {
            return (
              <Msg key={i} role={m.role}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#d84315', marginBottom: 4 }}>assistant</div>
                <Dots><span>•</span><span>•</span><span>•</span></Dots>
              </Msg>
            );
          }
          const cleaned = stripThinkBlocks(m.content);
          const isDup = m.role === 'assistant' && cleaned && isDupInEditor(cleaned);

          return (
            <Msg key={i} role={m.role}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: m.role === 'user' ? '#00796b' : '#d84315', marginBottom: 4 }}>
                {m.role}
              </div>
              {cleaned}
              {m.role === 'assistant' && cleaned && !isDup && (
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <IconBtn
                    onClick={() => handleApply(cleaned)}
                    disabled={!cleaned}
                    bg={'linear-gradient(90deg, #ffb347 0%, #ff5e62 100%)'}
                    title={'Send to editor'}
                    aria-label="Send to editor"
                  >
                    <SendIcon />
                  </IconBtn>
                </div>
              )}
            </Msg>
          );
        })}
      </List>

      {/* Compact footer: 85% input + ONE icon button (Send or Pause) */}
      <FooterBar>
        <PromptInput
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask the AI…"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (status === 'idle') send();
              else abortIfStreaming();                      // pressing Enter while streaming aborts
            }
          }}
          rows={1}
        />
        <Actions>
          {status === 'idle' ? (
            <IconBtn
              onClick={send}
              disabled={!input.trim()}
              bg="#194b1bff"
              aria-label="Send"
              title="Send"
            >
              <SendIcon />
            </IconBtn>
          ) : (
            <IconBtn
              onClick={abortIfStreaming}                   
              bg="#f60606ff"
              aria-label="Pause"
              title="Pause (abort generation)"
            >
              <PauseIcon />
            </IconBtn>
          )}
        </Actions>
      </FooterBar>
    </Aside>
  );
}


const Aside = styled.aside`
  display: flex; 
  flex-direction: column; 
  height: 100%; 
  width: 320px;
  min-width: 320px; 
  max-width: 320px; 
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 0 20px 20px 0;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
`;

const Head = styled.div`
  padding: 16px 20px;  
  font-weight: 700;
  font-size: 18px;
  color: #fff;
  text-align: center;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  position: relative;
  
  &::before {
    content: '🤖';
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 20px;
  }
`;

const List = styled.div`
  flex: 1; 
  overflow: auto; 
  padding: 16px; 
  display: flex; 
  flex-direction: column; 
  gap: 12px;  
  background: linear-gradient(135deg, rgba(34, 29, 16, 0.3) 0%, rgba(95, 45, 114, 0.3) 100%);
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
`;
const Msg = styled.div<{ role: string }>`
  border-radius: 18px; 
  padding: 14px 16px;
  background: ${p => p.role === 'user'
    ? 'linear-gradient(135deg, #a7ffeb 0%, #64b5f6 100%)'
    : 'linear-gradient(135deg, #ffe082 0%, #ff8a65 100%)'};
  color: #1a1a1a; 
  white-space: pre-wrap; 
  word-break: break-word;
  align-self: ${p => (p.role === 'user' ? 'flex-end' : 'flex-start')};
  max-width: 85%; 
  min-width: 120px; 
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  transform: translateY(0);
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2);
  }
  
  &::before {
    content: '';
    position: absolute;
    ${p => p.role === 'user' 
      ? 'bottom: 8px; right: -6px; border-left: 8px solid #64b5f6;' 
      : 'bottom: 8px; left: -6px; border-right: 8px solid #ff8a65;'
    }
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
  }
`;

const FooterBar = styled.div`
  display: grid; 
  grid-template-columns: 1fr auto; 
  align-items: center; 
  gap: 12px;
  padding: 16px 20px; 
  border-top: 1px solid rgba(255, 255, 255, 0.1);  
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  backdrop-filter: blur(20px);
`;

const PromptInput = styled.textarea`
  width: 100%; 
  min-height: 42px;
  max-height: 120px; 
  padding: 12px 16px; 
  border-radius: 21px;
  //border: 1px solid rgba(255, 255, 255, 0.2); 
  resize: none; 
  outline: none; 
  font-size: 14px; 
  line-height: 20px; 
  background: rgba(255, 255, 255, 0.9);
  color: #1a1a1a;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  font-family: inherit;
  
  &::placeholder {
    color: rgba(26, 26, 26, 0.5);
  }
  
  &:focus {
   // box-shadow: 0 0 0 3px rgba(0, 245, 255, 0.1);
    background: rgba(255, 255, 255, 0.95);
  }
  
  &:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }
`;

const Actions = styled.div` 
  display: flex; 
  align-items: center; 
  justify-content: center; 
`;

const IconBtn = styled.button<{ bg?: string }>`
  height: 42px; 
  width: 42px; 
  display: inline-flex; 
  align-items: center; 
  justify-content: center;
  border-radius: 21px; 
  border: none; 
  cursor: pointer; 
  background: ${({ bg }) => bg || '#e91752'};
  color: #fff; 
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
  }
  
  &:disabled { 
    opacity: 0.4; 
    cursor: not-allowed;
    transform: none;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transform: translateX(-100%);
    transition: transform 0.6s;
  }
  
  &:hover::before {
    transform: translateX(100%);
  }
`;

/* tiny inline icons (no text) */
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 12l18-9-5 18-5-6-8-3z" stroke="currentColor" strokeWidth="1.6" fill="none" />
  </svg>
);
const PauseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" />
  </svg>
);

const blink = keyframes` 0%,100%{opacity:.3} 50%{opacity:1} `;
const Dots = styled.span`
  font-size: 20px; letter-spacing: 2px;
  & > span { animation: ${blink} 1.2s infinite; opacity: .3; margin-right: 2px; }
  & > span:nth-child(2){animation-delay:.4s} & > span:nth-child(3){animation-delay:.8s}
`;


