# PRD — Agente IA no App Igreja Sede

**Projeto:** Kairós Igreja + Agente IA integrado
**Sessão:** 2026-09-16
**Status:** Aguardando aprovação do Pastor

---

## 1. Contexto

- App de gestão pastoral com **1 sede + 15 congregações**
- Hoje: secretárias acessam via navegador (Next.js + Prisma + SQLite, deploy Dokploy)
- **Objetivo:** integrar um agente IA no app, controlado por chat em linguagem natural, que consiga executar todas as operações de secretaria com segurança e isolar dados por congregação

---

## 2. Personas / Casos de uso

| Persona | Necessidade |
|---|---|
| **Pastora titular (Sede)** | Visão de todas as 15 congregações, relatórios consolidados |
| **Pastora de congregação** | Cadastrar membros, ver só sua congregação, gerar relatórios |
| **Secretária (qualquer nível)** | Cadastro rápido, busca, transferências, impressão de carteirinhas |
| **Tesoureiro** | Relatórios financeiros da sua congregação |

---

## 3. Tools propostas (20)

### 3.1 Membros (5 tools)

| Tool | Função |
|---|---|
| `igreja:cadastrar-membro` | Cria membro a partir de fala natural. Detecta congregação pelo contexto do usuário. |
| `igreja:buscar-membro` | Busca por nome, telefone, CPF ou congregação |
| `igreja:editar-membro` | Atualiza dados (telefone, endereço, cargo, status) |
| `igreja:transferir-membro` | Move entre congregações (mantém histórico) |
| `igreja:inativar-membro` | Marca como inativo (não deleta — LGPD) |

### 3.2 Congregações (3 tools)

| Tool | Função |
|---|---|
| `igreja:listar-congregacoes` | Lista as 15 com endereço, pastor responsável, nº de membros |
| `igreja:detalhes-congregacao` | Resumo de uma congregação (presença, financeiro, eventos) |
| `igreja:cadastrar-congregacao` | (Só pastora titular) Cria nova congregação |

### 3.3 Eventos / Agenda (4 tools)

| Tool | Função |
|---|---|
| `igreja:agendar-culto` | Cria evento (culto, reunião, visita) |
| `igreja:listar-agenda` | Mostra próximos eventos da congregação |
| `igreja:confirmar-presenca` | Marca membros presentes |
| `igreja:relatorio-presenca` | "% de presença do último culto" |

### 3.4 Documentos / PDFs (3 tools)

| Tool | Função |
|---|---|
| `igreja:gerar-carteirinha` | PDF da carteirinha de membro (frente/verso) |
| `igreja:gerar-ata` | PDF da ata de reunião |
| `igreja:gerar-relatorio` | PDF de relatório (membros, presença, financeiro) |

### 3.5 Comunicação (3 tools)

| Tool | Função |
|---|---|
| `igreja:enviar-mensagem` | Mensagem no app (inbox da congregação) |
| `igreja:lembrete-aniversariantes` | Lista aniversariantes da semana + sugere mensagem |
| `igreja:avisar-novo-membro` | Notifica pastor/líderes sobre novo cadastro |

### 3.6 Patrimônio (2 tools) — opcional Sprint 2

| Tool | Função |
|---|---|
| `igreja:cadastrar-patrimonio` | Móveis, veículos, imóveis da congregação |
| `igreja:listar-patrimonio` | Inventário |

---

## 4. Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js, PWA)                                         │
│                                                                  │
│   ┌─────────────────────┐        ┌────────────────────────┐     │
│   │ App existente       │        │ <SidebarChat />        │     │
│   │ (membros, agenda…)  │        │ Chat IA — abre/fecha   │     │
│   └─────────────────────┘        └───────────┬────────────┘     │
│                                              │                   │
│   ┌──────────────────────────────────────────▼──────────────┐    │
│   │  /api/chat  → POST mensagem + JWT                       │    │
│   └──────────────────────────────────────────┬──────────────┘    │
└──────────────────────────────────────────────┼───────────────────┘
                                               │ HTTP
┌──────────────────────────────────────────────▼───────────────────┐
│  Backend FastAPI novo: `chat-agent-api` (porta 8082)             │
│                                                                  │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  1. Valida JWT do Supabase (que kairos-igreja já usa)   │    │
│   │  2. Carrega perfil do usuário + congregação             │    │
│   │  3. Constrói contexto do system prompt com a congregação│    │
│   │  4. Loop de tools (Pi SDK) com tools filtradas por role │    │
│   │  5. Cada tool chama a API REST do kairos-igreja (proxy) │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
│   Tools registradas:                                             │
│     - igreja:cadastrar-membro  → POST /api/membros              │
│     - igreja:buscar-membro     → GET  /api/membros?q=           │
│     - igreja:agendar-culto     → POST /api/eventos              │
│     - … (20 tools no total)                                     │
└──────────────────────────────────────────────────────────────────┘
```

**Por que FastAPI separado?**
- Next.js + Supabase já cuida do app — não bagunçar
- FastAPI conversa direto com Pi SDK (stream de eventos)
- Independente pra escalar/deploy sem mexer no app

---

## 5. Segurança — isolamento por congregação

- Toda tool recebe `ctx.userId` e `ctx.role`
- Tools filtram dados automaticamente pela congregação do usuário
- Pastora titular vê TUDO (todas as 15 congregações)
- Pastora de congregação / secretária vê SÓ a dela
- Tesoureiro vê só financeiro da dele
- Logs de auditoria: toda ação do agente fica registrada em `chat_audit_log`

---

## 6. Plano de sprints (4 sprints × 1 commit cada)

| Sprint | Entrega |
|---|---|
| **2.1 — Fundação** | Scaffold `chat-agent-api` (FastAPI + Pi SDK), auth JWT, rota `/api/chat` mock. Frontend com `<SidebarChat />` que conversa. |
| **2.2 — Membros** | 5 tools de membro (cadastrar, buscar, editar, transferir, inativar) + filtros por congregação. |
| **2.3 — Agenda + PDFs** | 4 tools de agenda + 3 tools de PDF (carteirinha, ata, relatório). |
| **2.4 — Comunicação + Polish** | 3 tools de comunicação + 2 de patrimônio + audit log + onboarding. |

**Tempo estimado:** 4 sprints × ~1 dia cada = 4 dias de trabalho efetivo.

---

## 7. Custos

- OpenRouter free tier: $0/mês (modelo llama-3.1-8b free)
- VPS Dokploy: já roda (sem custo adicional)
- FastAPI container: ~50 MB RAM
- Sem dependência nova crítica

---

## 8. Riscos / pontos de atenção

1. **RLS do Supabase** — preciso verificar se as tabelas têm RLS ou se o filtro vai ter que ser feito no app (estou achando que é no app, igual ao kairos-crm).
2. **Auditoria LGPD** — todo cadastramento via agente precisa de log (quem pediu, quando, IP).
3. **PDFs em escala** — gerar 200 carteirinhas de uma vez pode travar; precisa de fila (BullMQ + Redis OU gerar sob demanda).

---

## 9. Próximos passos

**Pastor, me confirma:**
- ✅ Aprova lista de 20 tools? (ou quer adicionar/remover alguma?)
- ✅ Começo pelo **Sprint 2.1** (fundação)?
- ✅ Mesma máquina do Dokploy (187.77.229.227) — confirma?

Se aprovado, primeira ação: criar `chat-agent-api` no Dokploy + scaffold da extensão `kairos-igreja-agent` no monorepo.
