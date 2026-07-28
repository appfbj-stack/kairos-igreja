/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { QuickActionModal } from './components/QuickActionModal';

// Views
import { DashboardView } from './components/views/DashboardView';
import { MembrosView } from './components/views/MembrosView';
import { CelulasView } from './components/views/CelulasView';
import { CongregacoesView } from './components/views/CongregacoesView';
import { MinisteriosView } from './components/views/MinisteriosView';
import { EventosView } from './components/views/EventosView';
import { FinancasView } from './components/views/FinancasView';
import { OracaoView } from './components/views/OracaoView';
import { SermoesView } from './components/views/SermoesView';
import { VoluntariosView } from './components/views/VoluntariosView';
import { MuralView } from './components/views/MuralView';
import { ChatView } from './components/views/ChatView';

import { MemberModal } from './components/MemberModal';
import { StorageService } from './services/storage';
import {
  ViewMode,
  Member,
  Celula,
  Congregation,
  Asset,
  Ministry,
  EventItem,
  FinancialTransaction,
  PrayerRequest,
  Sermon,
  VolunteerRoster,
  MuralNotice,
  ChatMessage,
} from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCongregationId, setSelectedCongregationId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [quickModalTab, setQuickModalTab] = useState('membro');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // App Data State initialized from LocalStorage
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [finances, setFinances] = useState<FinancialTransaction[]>([]);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [rosters, setRosters] = useState<VolunteerRoster[]>([]);
  const [murals, setMurals] = useState<MuralNotice[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Load Data on Mount
  useEffect(() => {
    setCongregations(StorageService.getCongregations());
    setCelulas(StorageService.getCelulas());
    setMembers(StorageService.getMembers());
    setAssets(StorageService.getAssets());
    setMinistries(StorageService.getMinistries());
    setEvents(StorageService.getEvents());
    setFinances(StorageService.getFinances());
    setPrayers(StorageService.getPrayers());
    setSermons(StorageService.getSermons());
    setRosters(StorageService.getRosters());
    setMurals(StorageService.getMurals());
    setChatMessages(StorageService.getChatMessages());
  }, []);

  // Handlers for Congregations CRUD
  const handleAddCongregation = (newCong: Omit<Congregation, 'id'>) => {
    const item: Congregation = {
      ...newCong,
      id: `cong-${Date.now()}`,
    };

    // If new item is set as headquarters, update other items
    let updated = [...congregations];
    if (item.isHeadquarters) {
      updated = updated.map((c) => ({ ...c, isHeadquarters: false }));
    }
    updated.push(item);

    setCongregations(updated);
    StorageService.setCongregations(updated);
  };

  const handleUpdateCongregation = (updatedCong: Congregation) => {
    let updated = congregations.map((c) => {
      if (updatedCong.isHeadquarters && c.id !== updatedCong.id) {
        return { ...c, isHeadquarters: false };
      }
      return c.id === updatedCong.id ? updatedCong : c;
    });

    setCongregations(updated);
    StorageService.setCongregations(updated);
  };

  const handleDeleteCongregation = (id: string) => {
    if (congregations.length <= 1) {
      alert('Você precisa ter pelo menos uma congregação cadastrada no sistema.');
      return;
    }
    const updated = congregations.filter((c) => c.id !== id);
    setCongregations(updated);
    StorageService.setCongregations(updated);
    if (selectedCongregationId === id) {
      setSelectedCongregationId('all');
    }
  };

  // Handlers for Assets
  const handleAddAsset = (newAst: Partial<Asset>) => {
    const item: Asset = {
      id: `ast-${Date.now()}`,
      name: newAst.name || 'Novo Item de Patrimônio',
      category: newAst.category || 'Equipamento de Som',
      quantity: newAst.quantity || 1,
      estimatedValue: newAst.estimatedValue,
      condition: newAst.condition || 'Excelente',
      congregationId: newAst.congregationId || congregations[0]?.id || 'cong-1',
      locationDetails: newAst.locationDetails,
      acquisitionDate: newAst.acquisitionDate,
      notes: newAst.notes,
    };
    const updated = [item, ...assets];
    setAssets(updated);
    StorageService.setAssets(updated);
  };

  const handleUpdateAsset = (updatedAst: Asset) => {
    const updated = assets.map((a) => (a.id === updatedAst.id ? updatedAst : a));
    setAssets(updated);
    StorageService.setAssets(updated);
  };

  const handleDeleteAsset = (id: string) => {
    const updated = assets.filter((a) => a.id !== id);
    setAssets(updated);
    StorageService.setAssets(updated);
  };

  // Handlers for Members
  const handleSaveMember = (memberData: Omit<Member, 'id'> | Member) => {
    if ('id' in memberData && memberData.id) {
      const updated = members.map((m) => (m.id === memberData.id ? (memberData as Member) : m));
      setMembers(updated);
      StorageService.setMembers(updated);
    } else {
      const newMember: Member = {
        ...memberData,
        id: `mem-${Date.now()}`,
        joinedAt: memberData.joinedAt || new Date().toISOString().split('T')[0],
      } as Member;
      const updated = [newMember, ...members];
      setMembers(updated);
      StorageService.setMembers(updated);
    }
  };

  const handleAddMember = (newMem: Partial<Member>) => {
    const item: Member = {
      id: `mem-${Date.now()}`,
      name: newMem.name || 'Novo Membro',
      email: newMem.email || '',
      phone: newMem.phone || '',
      status: newMem.status || 'membro',
      congregationId: newMem.congregationId || congregations[0]?.id || 'cong-1',
      celulaId: newMem.celulaId,
      address: newMem.address,
      birthDate: newMem.birthDate,
      baptismDate: newMem.baptismDate,
      filiation: newMem.filiation,
      cpf: newMem.cpf,
      cardValidity: newMem.cardValidity,
      photoUrl: newMem.photoUrl,
      ministries: newMem.ministries || [],
      joinedAt: new Date().toISOString().split('T')[0],
    };
    const updated = [item, ...members];
    setMembers(updated);
    StorageService.setMembers(updated);
  };

  const handleDeleteMember = (id: string) => {
    const updated = members.filter((m) => m.id !== id);
    setMembers(updated);
    StorageService.setMembers(updated);
  };

  const handleBatchAddMembers = (newMembers: Member[]) => {
    const updated = [...newMembers, ...members];
    setMembers(updated);
    StorageService.setMembers(updated);
  };

  // Handlers for Celulas
  const handleAddCelula = (newCel: Partial<Celula>) => {
    const item: Celula = {
      id: `cel-${Date.now()}`,
      name: newCel.name || 'Nova Célula',
      leaderName: newCel.leaderName || 'Líder',
      leaderPhone: newCel.leaderPhone || '',
      hostName: newCel.hostName || 'Anfitrião',
      address: newCel.address || 'Endereço',
      neighborhood: newCel.neighborhood || 'Bairro',
      dayOfWeek: newCel.dayOfWeek || 'Quinta-feira',
      time: newCel.time || '20:00h',
      congregationId: newCel.congregationId || congregations[0]?.id || 'cong-1',
      membersCount: newCel.membersCount || 1,
      category: newCel.category || 'Jovens',
    };
    const updated = [item, ...celulas];
    setCelulas(updated);
    StorageService.setCelulas(updated);
  };

  const handleUpdateCelula = (updatedCel: Celula) => {
    const updated = celulas.map((c) => (c.id === updatedCel.id ? updatedCel : c));
    setCelulas(updated);
    StorageService.setCelulas(updated);
  };

  const handleDeleteCelula = (id: string) => {
    const updated = celulas.filter((c) => c.id !== id);
    setCelulas(updated);
    StorageService.setCelulas(updated);
  };

  // Handlers for Finances
  const handleAddFinance = (newFin: Partial<FinancialTransaction>) => {
    const item: FinancialTransaction = {
      id: `fin-${Date.now()}`,
      type: newFin.type || 'receita',
      category: newFin.category || 'Dízimo',
      amount: newFin.amount || 0,
      description: newFin.description || 'Lançamento',
      date: newFin.date || new Date().toISOString().split('T')[0],
      congregationId: congregations[0]?.id || 'cong-1',
      paymentMethod: 'Pix',
    };
    const updated = [item, ...finances];
    setFinances(updated);
    StorageService.setFinances(updated);
  };

  // Handlers for Prayer
  const handleAddPrayer = (newPrayer: Partial<PrayerRequest>) => {
    const item: PrayerRequest = {
      id: `pr-${Date.now()}`,
      authorName: newPrayer.authorName || 'Anônimo',
      isAnonymous: newPrayer.isAnonymous || false,
      category: newPrayer.category || 'Saúde',
      title: newPrayer.title || 'Pedido de Oração',
      description: newPrayer.description || '',
      date: newPrayer.date || new Date().toISOString().split('T')[0],
      prayedCount: 1,
      status: 'em_oracao',
    };
    const updated = [item, ...prayers];
    setPrayers(updated);
    StorageService.setPrayers(updated);
  };

  const handlePrayForRequest = (id: string) => {
    const updated = prayers.map((p) => (p.id === id ? { ...p, prayedCount: p.prayedCount + 1 } : p));
    setPrayers(updated);
    StorageService.setPrayers(updated);
  };

  const handleRegisterEvent = (eventId: string) => {
    const updated = events.map((ev) =>
      ev.id === eventId ? { ...ev, registeredCount: ev.registeredCount + 1 } : ev
    );
    setEvents(updated);
    StorageService.setEvents(updated);
  };

  const handleUpdateRosterStatus = (
    id: string,
    status: 'confirmado' | 'pendente' | 'recusado'
  ) => {
    const updated = rosters.map((r) => (r.id === id ? { ...r, status } : r));
    setRosters(updated);
    StorageService.setRosters(updated);
  };

  const handleLikeMural = (id: string) => {
    const updated = murals.map((m) => (m.id === id ? { ...m, likesCount: m.likesCount + 1 } : m));
    setMurals(updated);
    StorageService.setMurals(updated);
  };

  // Handlers for Sermons
  const handleAddSermon = (newSermon: Sermon) => {
    const updated = [newSermon, ...sermons];
    setSermons(updated);
    StorageService.setSermons(updated);
  };

  const handleUpdateSermon = (updatedSermon: Sermon) => {
    const updated = sermons.map((s) => (s.id === updatedSermon.id ? updatedSermon : s));
    setSermons(updated);
    StorageService.setSermons(updated);
  };

  const handleDeleteSermon = (id: string) => {
    const updated = sermons.filter((s) => s.id !== id);
    setSermons(updated);
    StorageService.setSermons(updated);
  };

  const handleSendChatMessage = (channelId: string, text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      channelId,
      senderName: 'Você (Liderança)',
      senderRole: 'Líder / Membro',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStaff: true,
    };
    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    StorageService.setChatMessages(updated);
  };

  const openQuickAction = (tabName: string) => {
    setQuickModalTab(tabName);
    setIsQuickModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#2a2a20] font-sans antialiased flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        unreadChatCount={3}
        prayersCount={prayers.filter((p) => p.status === 'em_oracao').length}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          congregations={congregations}
          selectedCongregationId={selectedCongregationId}
          onSelectCongregation={setSelectedCongregationId}
          onOpenQuickModal={() => openQuickAction('membro')}
          onResetData={StorageService.resetAllData}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              members={members}
              celulas={celulas}
              events={events}
              finances={finances}
              prayers={prayers}
              sermons={sermons}
              congregations={congregations}
              onNavigate={setCurrentView}
              onQuickAction={openQuickAction}
              onPrayForRequest={handlePrayForRequest}
            />
          )}

          {currentView === 'membros' && (
            <MembrosView
              members={members}
              celulas={celulas}
              congregations={congregations}
              onAddMember={() => {
                setEditingMember(null);
                setIsMemberModalOpen(true);
              }}
              onEditMember={(m) => {
                setEditingMember(m);
                setIsMemberModalOpen(true);
              }}
              onDeleteMember={handleDeleteMember}
              onBatchAddMembers={handleBatchAddMembers}
            />
          )}

          {currentView === 'celulas' && (
            <CelulasView
              celulas={celulas}
              congregations={congregations}
              onAddCelula={handleAddCelula}
              onUpdateCelula={handleUpdateCelula}
              onDeleteCelula={handleDeleteCelula}
            />
          )}

          {currentView === 'congregacoes' && (
            <CongregacoesView
              congregations={congregations}
              members={members}
              assets={assets}
              events={events}
              onAddCongregation={handleAddCongregation}
              onUpdateCongregation={handleUpdateCongregation}
              onDeleteCongregation={handleDeleteCongregation}
              onAddAsset={handleAddAsset}
              onUpdateAsset={handleUpdateAsset}
              onDeleteAsset={handleDeleteAsset}
              onAddEvent={() => openQuickAction('membro')}
            />
          )}

          {currentView === 'ministerios' && (
            <MinisteriosView
              ministries={ministries}
              onAddMinistry={() => openQuickAction('membro')}
            />
          )}

          {currentView === 'eventos' && (
            <EventosView
              events={events}
              congregations={congregations}
              onAddEvent={() => openQuickAction('membro')}
              onRegisterEvent={handleRegisterEvent}
            />
          )}

          {currentView === 'financas' && (
            <FinancasView
              finances={finances}
              congregations={congregations}
              onAddTransaction={() => openQuickAction('financas')}
            />
          )}

          {currentView === 'oracao' && (
            <OracaoView
              prayers={prayers}
              onAddPrayer={() => openQuickAction('oracao')}
              onPrayForRequest={handlePrayForRequest}
            />
          )}

          {currentView === 'sermoes' && (
            <SermoesView
              sermons={sermons}
              onAddSermon={handleAddSermon}
              onUpdateSermon={handleUpdateSermon}
              onDeleteSermon={handleDeleteSermon}
            />
          )}

          {currentView === 'voluntarios' && (
            <VoluntariosView
              rosters={rosters}
              onAddRoster={() => openQuickAction('membro')}
              onUpdateStatus={handleUpdateRosterStatus}
            />
          )}

          {currentView === 'mural' && (
            <MuralView
              murals={murals}
              onAddMural={() => openQuickAction('membro')}
              onLikeMural={handleLikeMural}
            />
          )}

          {currentView === 'chat' && (
            <ChatView
              chatMessages={chatMessages}
              onSendMessage={handleSendChatMessage}
            />
          )}
        </main>
      </div>

      {/* Global Quick Action Modal */}
      <QuickActionModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        initialTab={quickModalTab}
        congregations={congregations}
        onSaveMember={handleAddMember}
        onSaveCelula={handleAddCelula}
        onSaveFinance={handleAddFinance}
        onSavePrayer={handleAddPrayer}
      />

      {/* Comprehensive Member Registration & Edit Modal */}
      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
        initialData={editingMember}
        congregations={congregations}
        celulas={celulas}
        onOpenBatchImport={() => {
          setCurrentView('membros');
        }}
      />
    </div>
  );
}
