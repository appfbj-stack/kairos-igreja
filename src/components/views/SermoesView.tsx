import React, { useState } from 'react';
import {
  BookOpen,
  Play,
  Volume2,
  Sparkles,
  FileText,
  User,
  Tag,
  Search,
  Plus,
  Loader2,
  Edit2,
  Trash2,
  ExternalLink,
  Save,
} from 'lucide-react';
import { Sermon } from '../../types';
import { SermonModal } from '../SermonModal';

interface SermoesViewProps {
  sermons: Sermon[];
  onAddSermon: (sermon: Sermon) => void;
  onUpdateSermon: (sermon: Sermon) => void;
  onDeleteSermon: (id: string) => void;
}

export const SermoesView: React.FC<SermoesViewProps> = ({
  sermons,
  onAddSermon,
  onUpdateSermon,
  onDeleteSermon,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSermon, setActiveSermon] = useState<Sermon | null>(sermons[0] || null);

  // Modal State for Create/Edit
  const [isSermonModalOpen, setIsSermonModalOpen] = useState(false);
  const [editingSermon, setEditingSermon] = useState<Sermon | null>(null);

  // AI Outline State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTheme, setAiTheme] = useState('');
  const [aiPassage, setAiPassage] = useState('');
  const [aiAudience, setAiAudience] = useState('Igreja Geral');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOutline, setGeneratedOutline] = useState<any>(null);

  const filteredSermons = sermons.filter(
    (s) =>
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.preacher.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.biblePassage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.series && s.series.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenCreateModal = () => {
    setEditingSermon(null);
    setIsSermonModalOpen(true);
  };

  const handleOpenEditModal = (sermon: Sermon, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSermon(sermon);
    setIsSermonModalOpen(true);
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Tem certeza de que deseja excluir este sermão do acervo?')) {
      onDeleteSermon(id);
      if (activeSermon?.id === id) {
        const remaining = sermons.filter((s) => s.id !== id);
        setActiveSermon(remaining[0] || null);
      }
    }
  };

  const handleSaveSermon = (sermonData: Sermon) => {
    if (editingSermon) {
      onUpdateSermon(sermonData);
      if (activeSermon?.id === sermonData.id) {
        setActiveSermon(sermonData);
      }
    } else {
      onAddSermon(sermonData);
      setActiveSermon(sermonData);
    }
  };

  const handleConvertAiToSermon = () => {
    if (!generatedOutline) return;
    const summaryText = `Introdução: ${generatedOutline.introduction || ''}\n\nPontos Principais:\n${
      generatedOutline.mainPoints
        ?.map((p: any) => `• ${p.point}: ${p.explanation}`)
        .join('\n') || ''
    }\n\nConclusão: ${generatedOutline.conclusion || ''}\n\nOração: ${generatedOutline.prayer || ''}`;

    setEditingSermon({
      id: '',
      title: generatedOutline.title || aiTheme || 'Esboço de Pregação',
      preacher: 'Pastor',
      biblePassage: generatedOutline.passage || aiPassage || 'Passagem Bíblica',
      date: new Date().toISOString().split('T')[0],
      summary: summaryText,
      series: 'Gerado via IA Kairos',
      tags: ['IA Kairos', 'Esboço', 'Estudo'],
      viewsCount: 0,
    });
    setShowAiModal(false);
    setIsSermonModalOpen(true);
  };

  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGeneratedOutline(null);

    try {
      const res = await fetch('/api/ai/sermon-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: aiTheme,
          passage: aiPassage,
          audience: aiAudience,
        }),
      });

      const data = await res.json();
      setGeneratedOutline(data);
    } catch (err) {
      console.error(err);
      // Fallback in case of mock offline
      setGeneratedOutline({
        title: `Esboço: ${aiTheme}`,
        passage: aiPassage || 'Filipenses 4:6-7',
        introduction: `O tema "${aiTheme}" traz uma palavra transformadora sobre a caminhada cristã.`,
        mainPoints: [
          { point: '1. O Fundamento da Fé', explanation: 'Ancorando nossas esperanças nas promessas divinas.' },
          { point: '2. A Prática no Cotidiano', explanation: 'Demonstrando amor e perseverança nas tribulações.' },
        ],
        conclusion: 'Deus nos chama a viver com ousadia e confiança.',
        prayer: 'Senhor, abençoe esta mensagem na vida da congregação.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[#2a2a20] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#5a5a40]" />
            Acervo de Sermões & Pregações
          </h1>
          <p className="text-xs text-[#8a8a70] mt-1">
            Cadastre, edite, ouça mensagens, baixe esboços e prepare pregações inspiradoras com IA.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5a5a40] to-[#a68a64] hover:opacity-95 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            Gerador de Esboço IA
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2a2a20] hover:bg-[#1f1f18] text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            + Criar Sermão
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#8a8a70]" />
        <input
          type="text"
          placeholder="Buscar sermão por título, pregador, passagem ou série..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#e0e0d0] text-xs text-[#2a2a20] placeholder-[#8a8a70] focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20 shadow-xs"
        />
      </div>

      {/* Featured Sermon Player & Active Selection */}
      {activeSermon && (
        <div className="p-6 rounded-3xl bg-[#2a2a20] text-white shadow-xl relative overflow-hidden border border-[#5a5a40]/40">
          <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[#a68a64]/30 text-amber-300 border border-[#a68a64]/50">
                  Sermão em Destaque
                </span>
                {activeSermon.series && (
                  <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-white/10 text-slate-300">
                    {activeSermon.series}
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold font-serif text-white">{activeSermon.title}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-amber-400" /> {activeSermon.preacher}
                </span>
                <span>•</span>
                <span className="text-amber-300 font-semibold">{activeSermon.biblePassage}</span>
                <span>•</span>
                <span>{activeSermon.date}</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed pt-2 whitespace-pre-line">
                {activeSermon.summary}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {activeSermon.tags.map((tg, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-md bg-white/10 text-slate-300 text-[10px]"
                  >
                    #{tg}
                  </span>
                ))}
              </div>

              {/* Action Buttons inside Banner */}
              <div className="pt-4 flex items-center gap-3 border-t border-white/10">
                <button
                  onClick={(e) => handleOpenEditModal(activeSermon, e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-300" /> Editar Sermão
                </button>
                <button
                  onClick={(e) => handleDelete(activeSermon.id, e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-300" /> Excluir
                </button>
              </div>
            </div>

            {/* Audio / Resource Controls */}
            <div className="w-full md:w-72 p-4 rounded-2xl bg-white/10 border border-white/10 text-center space-y-3 shrink-0 backdrop-blur-xs">
              <div className="w-12 h-12 rounded-full bg-[#a68a64] text-white flex items-center justify-center mx-auto shadow-lg shadow-[#a68a64]/30 cursor-pointer hover:scale-105 transition-transform">
                <Play className="w-6 h-6 ml-0.5 fill-current" />
              </div>
              <p className="text-xs font-bold text-slate-200">Ouvir Mensagem em Áudio</p>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#a68a64] h-full w-1/3" />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>08:42</span>
                <span>38:15</span>
              </div>

              {activeSermon.videoUrl && (
                <a
                  href={activeSermon.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Ver no YouTube
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sermons Archive List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif font-bold text-lg text-[#2a2a20]">
            Todas as Pregações ({filteredSermons.length})
          </h2>
          <button
            onClick={handleOpenCreateModal}
            className="text-xs font-bold text-[#5a5a40] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Cadastrar Nova
          </button>
        </div>

        {filteredSermons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSermons.map((sermon) => (
              <div
                key={sermon.id}
                onClick={() => setActiveSermon(sermon)}
                className={`p-6 rounded-3xl bg-white border cursor-pointer transition-all relative flex flex-col justify-between ${
                  activeSermon?.id === sermon.id
                    ? 'border-[#5a5a40] ring-2 ring-[#5a5a40]/20 shadow-md'
                    : 'border-[#e0e0d0] hover:border-[#a68a64] shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-[#8a8a70] mb-2">
                    <span className="font-semibold text-[#5a5a40]">{sermon.biblePassage}</span>
                    <span>{sermon.date}</span>
                  </div>

                  <h3 className="font-bold text-[#2a2a20] text-base">{sermon.title}</h3>
                  <p className="text-xs text-[#8a8a70] mt-1 font-medium">{sermon.preacher}</p>
                  <p className="text-xs text-[#5a5a40] mt-3 line-clamp-3 leading-relaxed whitespace-pre-line">
                    {sermon.summary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e0e0d0] flex items-center justify-between text-[11px] text-[#8a8a70]">
                  <span className="truncate max-w-[130px]">{sermon.series || 'Mensagem Avulsa'}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleOpenEditModal(sermon, e)}
                      title="Editar Sermão"
                      className="p-1.5 rounded-lg hover:bg-[#f5f5f0] text-[#5a5a40] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(sermon.id, e)}
                      title="Excluir Sermão"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-[#e0e0d0]">
            <BookOpen className="w-10 h-10 text-[#a68a64] mx-auto mb-3" />
            <h3 className="font-serif font-bold text-[#2a2a20] text-base">
              Nenhum sermão encontrado
            </h3>
            <p className="text-xs text-[#8a8a70] mt-1">
              {searchTerm
                ? 'Tente mudar os termos de busca.'
                : 'Cadastre o primeiro sermão no acervo da igreja.'}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 rounded-xl bg-[#5a5a40] text-white text-xs font-bold hover:bg-[#4d4d36] transition-colors cursor-pointer"
            >
              + Criar Sermão
            </button>
          </div>
        )}
      </div>

      {/* Sermon Create/Edit Modal */}
      <SermonModal
        isOpen={isSermonModalOpen}
        onClose={() => setIsSermonModalOpen(false)}
        onSave={handleSaveSermon}
        initialData={editingSermon}
      />

      {/* AI Sermon Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#e0e0d0]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#5a5a40]/10 text-[#5a5a40]">
                  <Sparkles className="w-5 h-5 text-[#a68a64]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#2a2a20] text-lg">Gerador de Esboço Pastoral Kairos</h3>
                  <p className="text-xs text-[#8a8a70]">Crie sermões e estudos bíblicos com auxílio de IA</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-[#8a8a70] hover:text-[#2a2a20] text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleGenerateOutline} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2a2a20] uppercase mb-1">
                  Tema da Pregação
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: O Poder da Oração em Família, Fidelidade no Pouco..."
                  value={aiTheme}
                  onChange={(e) => setAiTheme(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f0] border border-[#e0e0d0] text-xs text-[#2a2a20] focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2a2a20] uppercase mb-1">
                    Passagem Bíblica
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Filipenses 4:6-7, Salmo 91"
                    value={aiPassage}
                    onChange={(e) => setAiPassage(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f0] border border-[#e0e0d0] text-xs text-[#2a2a20] focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2a2a20] uppercase mb-1">
                    Público Alvo
                  </label>
                  <select
                    value={aiAudience}
                    onChange={(e) => setAiAudience(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f0] border border-[#e0e0d0] text-xs text-[#2a2a20] focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/20 font-medium"
                  >
                    <option value="Igreja Geral">Culto Geral de Domingo</option>
                    <option value="Líderes de Célula">Encontro de Líderes</option>
                    <option value="Jovens">Culto de Jovens</option>
                    <option value="Casais">Reunião de Casais</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-[#5a5a40] hover:bg-[#4d4d36] text-white font-bold text-xs transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    Gerando Esboço Inspirado...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Gerar Esboço Completo
                  </>
                )}
              </button>
            </form>

            {generatedOutline && (
              <div className="mt-6 p-6 rounded-2xl bg-[#2a2a20] text-white space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold font-serif text-lg text-amber-400">
                    {generatedOutline.title}
                  </h4>
                  <button
                    onClick={handleConvertAiToSermon}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#a68a64] hover:bg-[#967a54] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar como Sermão
                  </button>
                </div>

                <p className="text-xs text-slate-300 font-bold">
                  Texto Base: {generatedOutline.passage}
                </p>

                <div className="space-y-2 text-xs text-slate-200">
                  <p>
                    <strong className="text-white">Introdução:</strong> {generatedOutline.introduction}
                  </p>

                  <div className="pt-2 space-y-2">
                    <p className="font-bold text-amber-300 uppercase text-[10px]">Pontos Principais:</p>
                    {generatedOutline.mainPoints?.map((pt: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-white/10 border border-white/10">
                        <p className="font-bold text-white text-xs">{pt.point}</p>
                        <p className="text-slate-300 text-[11px] mt-1">{pt.explanation}</p>
                      </div>
                    ))}
                  </div>

                  <p className="pt-2">
                    <strong className="text-white">Conclusão:</strong> {generatedOutline.conclusion}
                  </p>
                  <p className="italic text-slate-300 bg-white/10 p-3 rounded-xl border border-white/10">
                    "{generatedOutline.prayer}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

