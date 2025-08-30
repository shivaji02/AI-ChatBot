
export async function fetchAI({ message, doc, selection, action, model, onStream }: {
  message?: string;
  doc?: string;
  selection?: string;
  action?: string;
  model: string;
  onStream?: (chunk: string) => void;
}): Promise<{ isThinking: boolean; response: string }> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, doc, selection, action, model })
  });
  let isThinking = false;
  let response = '';
  if (res.headers.get('content-type')?.includes('text/event-stream')) {
    // Streaming response
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let done = false;
    if (reader) {
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (value) {
          const chunk = decoder.decode(value);
          chunk.split('\n').forEach(line => {
            if (line.startsWith('data: ')) {
              const text = line.slice(6);
              // Detect <think>...</think> blocks
              if (/^<think>[\s\S]*?<\/think>$/.test(text.trim())) {
                isThinking = true;
              } else {
                response += text;
                if (onStream) onStream(text);
              }
            }
          });
        }
        done = readerDone;
      }
    }
    return { isThinking, response };
  } else {
    const data = await res.json();
    if (/^<think>[\s\S]*?<\/think>$/.test(data.text?.trim() || '')) {
      return { isThinking: true, response: '' };
    }
    if (onStream) onStream(data.text || '');
    return { isThinking: false, response: data.text || '' };
  }
}
