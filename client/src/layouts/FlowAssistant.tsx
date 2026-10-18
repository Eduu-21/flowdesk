import { Send, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/Feedback';
import { useAskAssistant, useAssistantSuggestions } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { AssistantReply } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  items?: AssistantReply['items'];
  error?: boolean;
}

const GREETING: Message = {
  role: 'assistant',
  text: 'Hi, I’m Flow Assistant. Ask me about your schedule, customers, services or revenue.',
};

/** Small, optional helper. Answers come from the studio's own data. */
export function FlowAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [text, setText] = useState('');
  const ask = useAskAssistant();
  const suggestions = useAssistantSuggestions();
  const navigate = useNavigate();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, ask.isPending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const send = (question: string) => {
    const message = question.trim();
    if (!message || ask.isPending) return;
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setText('');
    ask.mutate(message, {
      onSuccess: (res) => setMessages((m) => [...m, { role: 'assistant', text: res.reply, items: res.items }]),
      onError: (error) => setMessages((m) => [...m, { role: 'assistant', text: errorMessage(error), error: true }]),
    });
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-plum-900 pl-4 pr-5 text-sm font-medium text-ivory shadow-pop transition-colors hover:bg-plum-700"
        >
          <Sparkles className="h-4 w-4 text-champagne" aria-hidden />
          Flow Assistant
        </button>
      )}
      {open && (
        <section
          aria-label="Flow Assistant"
          className="fixed inset-x-3 bottom-3 z-40 flex max-h-[min(34rem,calc(100vh-1.5rem))] animate-modal-in flex-col overflow-hidden rounded-panel border border-sand bg-ivory shadow-pop sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[24rem]"
        >
          <header className="flex items-center justify-between bg-plum-900 px-4 py-3 text-ivory">
            <span className="flex items-center gap-2 font-display text-xl">
              <Sparkles className="h-4 w-4 text-champagne" aria-hidden />
              Flow Assistant
            </span>
            <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-plum-700">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    m.role === 'user' ? 'bg-plum-700 text-ivory' : m.error ? 'bg-berry-100 text-berry' : 'bg-white text-ink shadow-sm',
                  )}
                >
                  <p>{m.text}</p>
                  {m.items && m.items.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-sand/70 pt-2">
                      {m.items.map((item, idx) => (
                        <li key={idx}>
                          {item.link ? (
                            <button
                              type="button"
                              onClick={() => {
                                navigate(item.link!);
                                setOpen(false);
                              }}
                              className="block w-full rounded-lg px-2 py-1 text-left hover:bg-lavender-50"
                            >
                              <span className="block font-medium text-plum-800">{item.label}</span>
                              {item.detail && <span className="block text-xs text-ink-mute">{item.detail}</span>}
                            </button>
                          ) : (
                            <span className="block px-2 py-1">{item.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {ask.isPending && (
              <div className="flex items-center gap-2 text-sm text-ink-mute">
                <Spinner className="h-4 w-4" /> Looking that up…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length === 1 && suggestions.data && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {suggestions.data.suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-sand bg-white px-3 py-1.5 text-left text-[13px] text-plum-800 hover:border-mauve-300 hover:bg-lavender-50">
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex gap-2 border-t border-sand/70 bg-white p-3"
          >
            <label htmlFor="assistant-input" className="sr-only">
              Ask Flow Assistant
            </label>
            <input
              ref={inputRef}
              id="assistant-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="Ask about your studio"
              className="h-10 min-w-0 flex-1 rounded-xl border border-sand px-3 text-sm placeholder:text-ink-mute/80 focus-visible:border-champagne"
            />
            <button
              type="submit"
              disabled={!text.trim() || ask.isPending}
              aria-label="Send question"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-plum-700 text-ivory hover:bg-plum-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
