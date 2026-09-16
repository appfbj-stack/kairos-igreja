/**
 * SidebarChat — widget de chat flutuante do agente IA do Kairos Igreja.
 *
 * Aparece como um botão redondo no canto inferior direito. Ao clicar, abre
 * um painel de chat (400px x 600px) onde a secretária/pastor conversa com o
 * agente em linguagem natural.
 *
 * Sprint 2.1: 1 tool só (buscar-membros) — modo mock, sem LLM real ainda.
 *
 * Por que não usa Redux/Context? É um componente independente, state local.
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  tool?: string;
  suggestions?: string[];
  timestamp: number;
}

function getToken(): string | null {
  try {
    return localStorage.getItem('kairos_token');
  } catch {
    return null;
  }
}

export const SidebarChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      text:
        'Olá! 👋 Sou o Kairós, seu assistente pastoral.\n\n' +
        'Por enquanto tô em modo teste (Sprint 2.1) — sei buscar membros. ' +
        'Experimente:\n\n• "busca Maria"\n• "tem o João Silva?"\n• "lista membros da Sede"',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(msg: string) {
    if (!msg.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: msg.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Você precisa estar logado pra usar o chat.');
      }

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: msg.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro no chat');

      const agentMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'agent',
        text: data.message ?? '(sem resposta)',
        tool: data.tool,
        suggestions: data.suggestions,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'agent',
          text: `❌ ${(err as Error).message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#5a5a40] hover:bg-[#4a4a30] text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
          title="Abrir chat Kairós"
        >
          <Sparkles size={22} className="group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Painel de chat */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col border border-stone-200"
          role="dialog"
          aria-label="Chat Kairós"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-gradient-to-r from-[#5a5a40] to-[#7a7a60] text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Sparkles size={20} />
              <div>
                <h3 className="font-semibold text-sm">Kairós — Assistente Pastoral</h3>
                <p className="text-xs opacity-80">Sprint 2.1 · modo teste</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Fechar chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f5f5f0]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#5a5a40] text-white rounded-br-sm'
                      : 'bg-white text-stone-800 border border-stone-200 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                  {m.tool && (
                    <div className="mt-1 pt-1 border-t border-stone-200 text-[10px] uppercase tracking-wide opacity-60">
                      🔧 {m.tool}
                    </div>
                  )}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {m.suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => send(s)}
                          className="text-left text-xs px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded text-stone-700 transition-colors"
                        >
                          → {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white px-3 py-2 rounded-2xl border border-stone-200 flex items-center gap-2 text-sm text-stone-600">
                  <Loader2 size={14} className="animate-spin" />
                  Kairós pensando...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-stone-200 p-2 bg-white rounded-b-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Pergunte algo..."
                rows={2}
                className="flex-1 resize-none px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#5a5a40]"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2 bg-[#5a5a40] hover:bg-[#4a4a30] disabled:bg-stone-300 text-white rounded-lg transition-colors"
                aria-label="Enviar"
              >
                <Send size={16} />
              </button>
            </form>
            <p className="text-[10px] text-stone-400 mt-1 px-1">
              Enter envia · Shift+Enter quebra linha · audit log ativo
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default SidebarChat;
