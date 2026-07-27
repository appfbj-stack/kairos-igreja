import React, { useState } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  User,
  Users,
  Home,
  Clock,
  ShieldCheck,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Congregation } from '../../types';
import { CongregationModal } from '../CongregationModal';

interface CongregacoesViewProps {
  congregations: Congregation[];
  onAddCongregation: (congregation: Omit<Congregation, 'id'>) => void;
  onUpdateCongregation?: (congregation: Congregation) => void;
  onDeleteCongregation?: (id: string) => void;
}

export const CongregacoesView: React.FC<CongregacoesViewProps> = ({
  congregations,
  onAddCongregation,
  onUpdateCongregation,
  onDeleteCongregation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCongregation, setEditingCongregation] = useState<Congregation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter congregations
  const filteredCongregations = congregations.filter((cong) => {
    const search = searchTerm.toLowerCase();
    return (
      cong.name.toLowerCase().includes(search) ||
      cong.leadPastor.toLowerCase().includes(search) ||
      cong.city.toLowerCase().includes(search) ||
      cong.address.toLowerCase().includes(search)
    );
  });

  const handleOpenAdd = () => {
    setEditingCongregation(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cong: Congregation) => {
    setEditingCongregation(cong);
    setIsModalOpen(true);
  };

  const handleSaveModal = (data: Omit<Congregation, 'id'> | Congregation) => {
    if ('id' in data && data.id) {
      if (onUpdateCongregation) {
        onUpdateCongregation(data as Congregation);
      }
    } else {
      onAddCongregation(data as Omit<Congregation, 'id'>);
    }
  };

  const handleDeleteConfirm = (id: string) => {
    if (onDeleteCongregation) {
      onDeleteCongregation(id);
    }
    setDeleteConfirmId(null);
  };

  const totalMembers = congregations.reduce((acc, c) => acc + (c.membersCount || 0), 0);
  const totalCelulas = congregations.reduce((acc, c) => acc + (c.celulasCount || 0), 0);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-[#5a5a40] text-[#f5f5f0] shadow-md border border-[#4d4d36]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4d4d36] text-[#a68a64] text-xs font-bold mb-2 border border-[#a68a64]/30">
            <Sparkles className="w-3.5 h-3.5 text-[#a68a64]" />
            Rede de Igrejas & Sedes
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-[#a68a64]" />
            Congregações & Campuses Kairos
          </h1>
          <p className="text-xs sm:text-sm text-[#e0d8c0] mt-1">
            Unidos no mesmo propósito em múltiplos locais da cidade. Gerencie dados, líderes e cultos.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#a68a64] hover:bg-[#8f7451] text-[#2a2a20] font-extrabold text-xs shadow-lg transition-all self-start md:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          + Nova Congregação / Campus
        </button>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#e0e0d0] flex items-center gap-4">
          <div className="p-3 rounded-xl bg-[#f5f5f0] text-[#5a5a40]">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#8a8a70] uppercase">Total de Campuses</p>
            <p className="text-xl font-bold font-serif text-[#2a2a20]">{congregations.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e0e0d0] flex items-center gap-4">
          <div className="p-3 rounded-xl bg-[#f5f5f0] text-[#a68a64]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#8a8a70] uppercase">Membros na Rede</p>
            <p className="text-xl font-bold font-serif text-[#2a2a20]">{totalMembers}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e0e0d0] flex items-center gap-4">
          <div className="p-3 rounded-xl bg-[#f5f5f0] text-[#5a5a40]">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#8a8a70] uppercase">Células Ativas</p>
            <p className="text-xl font-bold font-serif text-[#2a2a20]">{totalCelulas}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-[#e0e0d0] shadow-xs">
        <Search className="w-4 h-4 text-[#8a8a70] ml-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar campus por nome, pastor, cidade ou endereço..."
          className="w-full bg-transparent border-none focus:outline-none text-xs text-[#2a2a20] placeholder-[#8a8a70] py-1.5"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-[#8a8a70] hover:text-[#2a2a20] px-3 font-semibold"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Congregations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCongregations.map((cong) => (
          <div
            key={cong.id}
            className={`p-6 rounded-[28px] bg-white border transition-all flex flex-col justify-between relative overflow-hidden group ${
              cong.isHeadquarters
                ? 'border-[#5a5a40] ring-2 ring-[#5a5a40]/20 shadow-md'
                : 'border-[#e0e0d0] hover:border-[#a68a64] shadow-xs hover:shadow-md'
            }`}
          >
            {/* Headquarters Badge */}
            {cong.isHeadquarters && (
              <div className="absolute top-0 right-0 bg-[#5a5a40] text-[#f5f5f0] text-[10px] font-extrabold uppercase px-3.5 py-1.5 rounded-bl-2xl flex items-center gap-1.5 tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-[#a68a64]" />
                Matriz / Sede
              </div>
            )}

            <div>
              {/* Title & Actions */}
              <div className="flex items-start justify-between pr-20">
                <h2 className="text-xl font-bold font-serif text-[#2a2a20]">{cong.name}</h2>
              </div>

              {/* Information List */}
              <div className="mt-4 space-y-2.5 text-xs text-[#3d3d3d]">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#a68a64] shrink-0" />
                  <span>
                    Pastor Responsável:{' '}
                    <strong className="text-[#2a2a20] font-semibold">{cong.leadPastor}</strong>
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#8a8a70] shrink-0 mt-0.5" />
                  <span>
                    {cong.address} - {cong.city}
                  </span>
                </div>

                {cong.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#8a8a70] shrink-0" />
                    <span>{cong.phone}</span>
                  </div>
                )}
              </div>

              {/* Service Schedule Pills */}
              <div className="mt-5 pt-4 border-t border-[#e0e0d0]">
                <p className="text-[11px] font-bold text-[#8a8a70] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#a68a64]" /> Horários dos Cultos
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cong.servicesSchedule?.map((sch, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-xl bg-[#f5f5f0] text-[#2a2a20] text-[11px] font-medium border border-[#e0e0d0]"
                    >
                      {sch}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Stats & CRUD Action Buttons */}
            <div>
              <div className="mt-5 pt-4 border-t border-[#e0e0d0] grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-[#f5f5f0]">
                  <span className="text-[10px] text-[#8a8a70] uppercase font-bold block">
                    Membros
                  </span>
                  <span className="text-base font-bold text-[#5a5a40] flex items-center justify-center gap-1 mt-0.5 font-serif">
                    <Users className="w-3.5 h-3.5" />
                    {cong.membersCount || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#f5f5f0]">
                  <span className="text-[10px] text-[#8a8a70] uppercase font-bold block">
                    Células
                  </span>
                  <span className="text-base font-bold text-[#a68a64] flex items-center justify-center gap-1 mt-0.5 font-serif">
                    <Home className="w-3.5 h-3.5" />
                    {cong.celulasCount || 0}
                  </span>
                </div>
              </div>

              {/* CRUD Action Buttons */}
              <div className="mt-4 pt-3 border-t border-[#e0e0d0] flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenEdit(cong)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#f5f5f0] hover:bg-[#5a5a40] hover:text-white text-[#2a2a20] font-bold text-xs transition-colors border border-[#e0e0d0]"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>

                {deleteConfirmId === cong.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDeleteConfirm(cong.id)}
                      className="px-2.5 py-2 rounded-xl bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2.5 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold text-[11px]"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(cong.id)}
                    title="Excluir congregação"
                    className="p-2 rounded-xl text-[#8a8a70] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredCongregations.length === 0 && (
          <div className="col-span-full p-12 text-center rounded-3xl bg-white border border-[#e0e0d0]">
            <Building2 className="w-10 h-10 text-[#8a8a70] mx-auto mb-3" />
            <h3 className="font-serif font-bold text-lg text-[#2a2a20]">Nenhuma congregação encontrada</h3>
            <p className="text-xs text-[#8a8a70] mt-1">
              Tente buscar com outro termo ou cadastre um novo campus.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 rounded-xl bg-[#5a5a40] text-[#f5f5f0] text-xs font-bold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Cadastrar Igreja
            </button>
          </div>
        )}
      </div>

      {/* Congregation CRUD Modal */}
      <CongregationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
        initialData={editingCongregation}
      />
    </div>
  );
};
