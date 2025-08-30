import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { fetchAI } from '../clientCalls';

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
  display: flex; flex-direction: column; height: 100%; bottom:5%;width: 320px;min-height:200px; min-width: 320px; max-width: 320px; background:transparent;
    border-bottom: 1px solid #a4abadff;

`;
const Head = styled.div`
  padding: 12px 16px;  font-weight: 600;
  border-bottom: 1px solid #236a80ff;
`;
const List = styled.div`
  flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px;  background: linear-gradient(90deg, #221d10ff 0%, #5f2d72ff 100%);
`;
const Msg = styled.div<{ role: string }>`
  border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px;
  background: ${p => p.role === 'user'
    ? 'linear-gradient(90deg, #a7ffeb 0%, #64b5f6 100%)'
    : 'linear-gradient(90deg, #ffe082 0%, #ff8a65 100%)'};
  color: #222; white-space: pre-wrap; word-break: break-word;
  align-self: ${p => (p.role === 'user' ? 'flex-end' : 'flex-start')};
  max-width: 80%; min-width: 120px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
`;

const FooterBar = styled.div`
  display: grid; grid-template-columns: 85% 1fr; align-items: center; gap: 8px;
  padding: 10px 12px; height: 56px; border-top: 1px solid #236a80ff;  box-sizing: border-box;
`;

const PromptInput = styled.textarea`
  width: 100%; height: 40px; padding: 10px 12px; border-radius: 10px;
  border: 1px solid #141518ff; resize: none; outline: none; font-size: 14px; line-height: 20px; background: #fff;
  overflow: hidden; /* never grow */
  color: #222;
`;

const Actions = styled.div` display: flex; align-items: center; justify-content: flex-start; `;

const IconBtn = styled.button<{ bg?: string }>`
  height: 40px; width: 44px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 10px; border: none; cursor: pointer; background: ${({ bg }) => bg || '#e91752'};
  color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  &:disabled { opacity: .5; cursor: not-allowed; }
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


