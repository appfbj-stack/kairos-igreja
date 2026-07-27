import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Hash,
  Users,
  ShieldAlert,
  Search,
  CheckCheck,
} from 'lucide-react';
import { ChatMessage, ChatChannel } from '../../types';
import { INITIAL_CHAT_CHANNELS } from '../../data/mockData';

interface ChatViewProps {
  chatMessages: ChatMessage[];
  onSendMessage: (channelId: string, text: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  chatMessages,
  onSendMessage,
}) => {
  const [activeChannelId, setActiveChannelId] = useState<string>('ch-geral');
  const [inputText, setInputText] = useState('');

  const activeChannel =
    INITIAL_CHAT_CHANNELS.find((ch) => ch.id === activeChannelId) || INITIAL_CHAT_CHANNELS[0];

  const currentChannelMessages = chatMessages.filter((m) => m.channelId === activeChannelId);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(activeChannelId, inputText.trim());
    setInputText('');
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col md:flex-row bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden animate-in fade-in duration-200">
      {/* Channels Sidebar */}
      <div className="w-full md:w-64 bg-slate-900 text-slate-200 p-4 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 px-2 pb-4 border-b border-slate-800">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <span className="font-bold font-serif text-white text-base">Canais de Chat</span>
          </div>

          <div className="mt-4 space-y-1">
            {INITIAL_CHAT_CHANNELS.map((channel) => {
              const isActive = channel.id === activeChannelId;
              return (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannelId(channel.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Hash className="w-4 h-4 text-indigo-300 shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </div>
                  {channel.unreadCount && channel.unreadCount > 0 && !isActive ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                      {channel.unreadCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/60 text-[11px] text-slate-400">
          <p className="font-bold text-slate-200">Comunidade Kairos</p>
          <p className="mt-0.5">Respeite os irmãos e mantenha o amor nas conversas.</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col justify-between bg-slate-50/50">
        {/* Active Channel Header */}
        <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">#{activeChannel.name}</h2>
              <p className="text-[11px] text-slate-500">{activeChannel.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            <Users className="w-3.5 h-3.5" />
            <span>Membros Ativos</span>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar">
          {currentChannelMessages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 group">
              <img
                src={
                  msg.senderAvatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    msg.senderName
                  )}&background=4f46e5&color=fff`
                }
                alt={msg.senderName}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-white shrink-0 mt-0.5"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-xs text-slate-900">{msg.senderName}</span>
                  {msg.isStaff && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-800 uppercase">
                      Liderança
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                </div>

                <div className="mt-1 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs text-xs text-slate-800 w-fit max-w-xl leading-relaxed">
                  {msg.text}
                </div>
              </div>
            </div>
          ))}

          {currentChannelMessages.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhuma mensagem ainda neste canal. Seja o primeiro a enviar!
            </div>
          )}
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSend} className="p-3 sm:p-4 bg-white border-t border-slate-200/80 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Enviar mensagem em #${activeChannel.name}...`}
            className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-800"
          />
          <button
            type="submit"
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition-all active:scale-95"
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
