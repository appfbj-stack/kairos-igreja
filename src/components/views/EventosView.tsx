import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { EventItem, Congregation } from '../../types';

interface EventosViewProps {
  events: EventItem[];
  congregations: Congregation[];
  onAddEvent: () => void;
  onRegisterEvent: (eventId: string) => void;
}

export const EventosView: React.FC<EventosViewProps> = ({
  events,
  congregations,
  onAddEvent,
  onRegisterEvent,
}) => {
  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-rose-500" />
            Agenda & Eventos da Igreja
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cultos, conferências, batismos e encontros especiais.
          </p>
        </div>

        <button
          onClick={onAddEvent}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-200 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          + Criar Novo Evento
        </button>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.map((evt) => {
          const congregation = congregations.find((c) => c.id === evt.congregationId);

          return (
            <div
              key={evt.id}
              className="rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              {evt.bannerUrl && (
                <div className="h-44 w-full relative overflow-hidden bg-slate-900">
                  <img
                    src={evt.bannerUrl}
                    alt={evt.title}
                    className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-amber-400 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border border-amber-500/30">
                    {evt.type}
                  </div>
                </div>
              )}

              <div className="p-6">
                {!evt.bannerUrl && (
                  <span className="inline-block bg-rose-100 text-rose-800 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full mb-3">
                    {evt.type}
                  </span>
                )}

                <h2 className="text-lg font-bold font-serif text-slate-900">{evt.title}</h2>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{evt.description}</p>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="font-semibold text-slate-800">{evt.date}</span>
                    <Clock className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                    <span>{evt.time}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {evt.location} ({congregation?.name || 'Geral'})
                    </span>
                  </div>

                  {evt.speaker && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        Preletor/Ministro:{' '}
                        <strong className="text-slate-800 font-semibold">{evt.speaker}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>
                    <strong>{evt.registeredCount}</strong>
                    {evt.capacity ? ` / ${evt.capacity} vagas` : ' inscritos'}
                  </span>
                </div>

                <button
                  onClick={() => onRegisterEvent(evt.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Garantir Vaga / Inscrever
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
