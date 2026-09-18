import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2, Sparkles } from "lucide-react";

interface ToolUse {
  name: string;
  args: any;
  result: any;
}

interface Msg {
  role: "user" | "assistant";
  text: string;
  tools?: ToolUse[];
}

const EXAMPLES = [
  "Cadastra a Maria Silva, batismo 15/08/2026, congregação Cidade Jardim",
  "Busca o membro João Silva",
  "Quantos membros temos na congregação Cajuru?",
  "Edita o Carlos Souza: mudou o telefone para 11999998888",
];

export const ChatSecretaria: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Oi! 👋 Sou o assistente da secretaria. Posso cadastrar, buscar e editar membros pra você — é só falar em linguagem natural.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs, open]);

  const callAgent = async (message: string) => {
    const token = localStorage.getItem("kairos_token") || localStorage.getItem("token") || "";
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, conversationId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data.data;
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const out = await callAgent(text);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: out.reply || out.message || "(sem resposta)",
          tools: out.toolsUsed || out.tools || [],
        },
      ]);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: `❌ Erro: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Agente IA - Cadastro de membros por texto"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {/* Painel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-[#e0e0d0] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white px-4 py-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Agente Secretaria IA</p>
              <p className="text-[10px] opacity-80">Cadastro por linguagem natural • Kairos Igreja</p>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-80 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#f8f8f0]">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs ${
                    m.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-sm"
                      : "bg-white border border-[#e0e0d0] text-[#2a2a20] rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.tools && m.tools.length > 0 && (
                    <details className="mt-2 pt-2 border-t border-[#e0e0d0]">
                      <summary className="text-[10px] text-emerald-700 cursor-pointer font-bold">
                        🔧 {m.tools.length} ferramenta(s) usada(s)
                      </summary>
                      <div className="mt-1 space-y-1">
                        {m.tools.map((t, j) => (
                          <div key={j} className="text-[10px] font-mono bg-emerald-50 px-1.5 py-1 rounded">
                            <p className="font-bold text-emerald-700">{t.name}</p>
                            {t.args && (
                              <pre className="text-[9px] text-[#5a5a40] whitespace-pre-wrap break-all">
                                {JSON.stringify(t.args, null, 0)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#e0e0d0] rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-2 text-xs text-[#5a5a40]">
                  <Loader2 className="w-3 h-3 animate-spin" /> pensando...
                </div>
              </div>
            )}
          </div>

          {/* Sugestões iniciais */}
          {msgs.length <= 1 && (
            <div className="px-3 py-2 border-t border-[#e0e0d0] bg-white">
              <p className="text-[10px] font-bold text-[#8a8a70] mb-1">💡 Exemplos:</p>
              <div className="flex flex-wrap gap-1">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(ex)}
                    className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                  >
                    {ex.slice(0, 38)}{ex.length > 38 ? "..." : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[#e0e0d0] p-2 bg-white flex gap-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ex: cadastra Maria Silva, batismo 15/08, congregação Cajuru"
              rows={2}
              className="flex-1 resize-none px-2 py-1 rounded-lg border border-[#e0e0d0] text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 text-white flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatSecretaria;
