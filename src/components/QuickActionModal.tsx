import React, { useState } from 'react';
import { X, UserPlus, Home, DollarSign, Flame, Calendar, BookOpen } from 'lucide-react';
import { MemberStatus, Congregation } from '../types';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  congregations: Congregation[];
  onSaveMember: (data: any) => void;
  onSaveCelula: (data: any) => void;
  onSaveFinance: (data: any) => void;
  onSavePrayer: (data: any) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'membro',
  congregations,
  onSaveMember,
  onSaveCelula,
  onSaveFinance,
  onSavePrayer,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Form States
  // 1. Membro
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberStatus, setMemberStatus] = useState<MemberStatus>('membro');
  const [memberRole, setMemberRole] = useState('');
  const [memberCongregationId, setMemberCongregationId] = useState(congregations[0]?.id || '');
  const [memberCpf, setMemberCpf] = useState('');
  const [memberAddress, setMemberAddress] = useState('');
  const [memberBirthDate, setMemberBirthDate] = useState('');
  const [memberBaptismDate, setMemberBaptismDate] = useState('');
  const [memberFiliation, setMemberFiliation] = useState('');
  const [memberCardValidity, setMemberCardValidity] = useState('');
  const [memberPhotoUrl, setMemberPhotoUrl] = useState('');

  // 2. Célula
  const [celulaName, setCelulaName] = useState('');
  const [celulaLeader, setCelulaLeader] = useState('');
  const [celulaPhone, setCelulaPhone] = useState('');
  const [celulaCategory, setCelulaCategory] = useState<'Jovens' | 'Casais' | 'Mista' | 'Mulheres' | 'Homens' | 'Kids'>('Jovens');

  // 3. Finanças
  const [finType, setFinType] = useState<'receita' | 'despesa'>('receita');
  const [finCategory, setFinCategory] = useState<'Dízimo' | 'Oferta' | 'Missões' | 'Evento' | 'Aluguel/Contas' | 'Manutenção' | 'Ação Social' | 'Outros'>('Dízimo');
  const [finAmount, setFinAmount] = useState('');
  const [finDescription, setFinDescription] = useState('');

  // 4. Oração
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerAuthor, setPrayerAuthor] = useState('');
  const [prayerCategory, setPrayerCategory] = useState<'Saúde' | 'Família' | 'Finanças' | 'Espiritual' | 'Trabalho' | 'Outro'>('Saúde');
  const [prayerDescription, setPrayerDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmitMember = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveMember({
      name: memberName,
      email: memberEmail,
      phone: memberPhone,
      status: memberStatus,
      role: memberRole,
      congregationId: memberCongregationId || congregations[0]?.id,
      cpf: memberCpf,
      address: memberAddress,
      birthDate: memberBirthDate,
      baptismDate: memberBaptismDate,
      filiation: memberFiliation,
      cardValidity: memberCardValidity,
      photoUrl: memberPhotoUrl,
    });
    onClose();
  };

  const handleSubmitCelula = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCelula({
      name: celulaName,
      leaderName: celulaLeader,
      leaderPhone: celulaPhone,
      hostName: celulaLeader,
      address: 'Endereço a definir',
      neighborhood: 'Bairro',
      dayOfWeek: 'Quinta-feira',
      time: '20:00h',
      category: celulaCategory,
      congregationId: congregations[0]?.id,
      membersCount: 1,
    });
    onClose();
  };

  const handleSubmitFinance = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveFinance({
      type: finType,
      category: finCategory,
      amount: parseFloat(finAmount) || 0,
      description: finDescription,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Pix',
      congregationId: congregations[0]?.id,
    });
    onClose();
  };

  const handleSubmitPrayer = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePrayer({
      title: prayerTitle,
      authorName: prayerAuthor || 'Irmão(ã)',
      isAnonymous: !prayerAuthor,
      category: prayerCategory,
      description: prayerDescription,
      date: new Date().toISOString().split('T')[0],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="font-bold font-serif text-slate-900 text-lg">Cadastro Rápido Kairos</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-4 gap-1.5 my-4 bg-slate-100 p-1 rounded-2xl text-xs font-semibold">
          {[
            { id: 'membro', label: 'Membro', icon: UserPlus },
            { id: 'celula', label: 'Célula', icon: Home },
            { id: 'financas', label: 'Finanças', icon: DollarSign },
            { id: 'oracao', label: 'Oração', icon: Flame },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1 py-2 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Forms */}
        {activeTab === 'membro' && (
          <form onSubmit={handleSubmitMember} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: João da Silva"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={memberCpf}
                  onChange={(e) => setMemberCpf(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Status no Corpo
                </label>
                <select
                  value={memberStatus}
                  onChange={(e) => setMemberStatus(e.target.value as MemberStatus)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                >
                  <option value="membro">Membro</option>
                  <option value="visitante">Visitante</option>
                  <option value="lider">Líder</option>
                  <option value="discipulado">Em Discipulado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Função / Cargo Eclesiástico (Preenchível)
              </label>
              <input
                type="text"
                placeholder="Ex: Pastor, Evangelista, Presbítero, Diácono, Obreiro..."
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  placeholder="joao@email.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  placeholder="(11) 99999-8888"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Endereço Completo
              </label>
              <input
                type="text"
                placeholder="Rua, Número, Bairro, Cidade..."
                value={memberAddress}
                onChange={(e) => setMemberAddress(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Data Nasc.
                </label>
                <input
                  type="date"
                  value={memberBirthDate}
                  onChange={(e) => setMemberBirthDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Data Batismo
                </label>
                <input
                  type="date"
                  value={memberBaptismDate}
                  onChange={(e) => setMemberBaptismDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Filiação (Nome do Pai & Mãe)
              </label>
              <input
                type="text"
                placeholder="Pai e Mãe..."
                value={memberFiliation}
                onChange={(e) => setMemberFiliation(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Validade Carteirinha
                </label>
                <input
                  type="date"
                  value={memberCardValidity}
                  onChange={(e) => setMemberCardValidity(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Foto (URL)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={memberPhotoUrl}
                  onChange={(e) => setMemberPhotoUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 transition-all mt-2"
            >
              Salvar Membro
            </button>
          </form>
        )}

        {activeTab === 'celula' && (
          <form onSubmit={handleSubmitCelula} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Nome da Célula *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Célula Peniel"
                value={celulaName}
                onChange={(e) => setCelulaName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Nome do Líder
                </label>
                <input
                  type="text"
                  required
                  placeholder="Líder"
                  value={celulaLeader}
                  onChange={(e) => setCelulaLeader(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Categoria
                </label>
                <select
                  value={celulaCategory}
                  onChange={(e) => setCelulaCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                >
                  <option value="Jovens">Jovens</option>
                  <option value="Casais">Casais</option>
                  <option value="Mista">Mista</option>
                  <option value="Mulheres">Mulheres</option>
                  <option value="Homens">Homens</option>
                  <option value="Kids">Kids</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-200 transition-all mt-2"
            >
              Criar Célula
            </button>
          </form>
        )}

        {activeTab === 'financas' && (
          <form onSubmit={handleSubmitFinance} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Tipo
                </label>
                <select
                  value={finType}
                  onChange={(e) => setFinType(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                >
                  <option value="receita">Entrada (Receita)</option>
                  <option value="despesa">Saída (Despesa)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="150.00"
                  value={finAmount}
                  onChange={(e) => setFinAmount(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Descrição
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Dízimo Culto de Domingo..."
                value={finDescription}
                onChange={(e) => setFinDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-200 transition-all mt-2"
            >
              Lançar no Caixa
            </button>
          </form>
        )}

        {activeTab === 'oracao' && (
          <form onSubmit={handleSubmitPrayer} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Título do Pedido *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Saúde da minha família, Novo Emprego..."
                value={prayerTitle}
                onChange={(e) => setPrayerTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Descrição / Detalhes
              </label>
              <textarea
                rows={2}
                required
                placeholder="Escreva brevemente o motivo de oração..."
                value={prayerDescription}
                onChange={(e) => setPrayerDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-200 transition-all mt-2"
            >
              Publicar no Mural de Oração
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
