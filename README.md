# 🖥️ Gestão de Ativos de TI

[![Tests](https://github.com/Airton659/GATI/actions/workflows/tests.yml/badge.svg)](https://github.com/Airton659/GATI/actions/workflows/tests.yml)

![C#](https://img.shields.io/badge/C%23%20.NET%208-0f172a?style=for-the-badge&logo=dotnet&logoColor=a78bfa)
![React](https://img.shields.io/badge/React%2019-0f172a?style=for-the-badge&logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-0f172a?style=for-the-badge&logo=typescript&logoColor=38bdf8)
![SQL Server](https://img.shields.io/badge/SQL%20Server-0f172a?style=for-the-badge&logo=microsoftsqlserver&logoColor=f87171)
![Docker](https://img.shields.io/badge/Docker-0f172a?style=for-the-badge&logo=docker&logoColor=38bdf8)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-0f172a?style=for-the-badge&logo=githubactions&logoColor=4ade80)

> Sistema web para controle, rastreabilidade e gestão de patrimônio tecnológico. Desenvolvido para substituir planilhas e processos manuais por um fluxo digital completo: do cadastro do equipamento até a geração e envio do termo de responsabilidade por e-mail.
> 
> ⚠️ Este é o repositório público do projeto. A versão em produção roda em ambiente privado com CI/CD ativo, integração ao SQL Server institucional e deploy via Docker + Portainer em servidor Linux.
---

## Visão Geral

O GATI centraliza toda a gestão de ativos de TI em uma única plataforma, cobrindo:

- Cadastro e inventário completo de equipamentos
- Controle de localização e responsável por equipamento
- Movimentações com geração de termo PDF assinado
- Troca de responsabilidade com validação por senha e foto de confirmação
- Envio automático de e-mail com o termo em anexo
- Log de auditoria rastreável de todas as ações
- Relatórios gerenciais exportáveis em PDF
- Controle de acesso por perfis e permissões

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS + TanStack Query |
| Backend | C# .NET 8 (ASP.NET Core Web API) |
| ORM / Queries | Dapper |
| Banco de Dados | Microsoft SQL Server |
| PDF | QuestPDF |
| E-mail | SMTP (Gmail) |
| Autenticação | JWT Bearer |
| Infra | Docker + Docker Compose |
| CI/CD | GitHub Actions → GitHub Container Registry (`ghcr.io`) |

---

## Funcionalidades

### Ativos (Equipamentos)
- Cadastro completo com tipo, marca, modelo, número de série, patrimônio, valor, estado de conservação e fornecedor
- Associação de localização e responsável
- Upload de fotos do equipamento
- Ativação / desativação
- Filtros avançados por tipo, localização, status, responsável e fornecedor
- Paginação server-side

### Movimentações
- Registro de movimentação de equipamentos entre localizações
- Geração de termo PDF por lote com assinaturas digitais cadastradas nos perfis dos usuários
- Captura de foto de confirmação via câmera do dispositivo no momento da entrega
- Envio automático do termo por e-mail ao gestor responsável (SMTP)
- Histórico completo com filtros por data, técnico, gestor, origem e destino

### Troca de Responsabilidade
- Transferência de custódia sem mudança de localização
- Validação por senha do novo responsável antes de confirmar
- Termo de Troca de Responsabilidade gerado em PDF — distinto do termo de movimentação
- E-mail específico enviado ao novo responsável com identificação de quem transferiu
- Registro do responsável anterior no termo e no log de auditoria

### Usuários e Permissões
- Cadastro de usuários com perfil de acesso
- Perfis com permissões granulares por recurso e ação (`equipamentos:criar`, `movimentacoes:ler`, etc.)
- Assinatura digital cadastrada no perfil (canvas à mão livre), utilizada nos termos PDF
- Alteração de senha pelo próprio usuário
- Administração de acessos por perfil

### Relatórios (PDF exportável)

| Relatório | Descrição |
|---|---|
| Inventário Geral | Fotografia completa do patrimônio, agrupada por localização |
| Ativos por Localização | Distribuição de equipamentos por sala, bloco e campus |
| Histórico de Movimentações | Rastreabilidade completa para compliance |
| Ativos por Responsável | Quem guarda quais equipamentos |
| Equipamentos Inativos | Lista de bens fora de uso para gestão de manutenção |
| Termos por Responsável / Período | Centraliza os termos assinados com busca por pessoa ou data |

### Auditoria
- Log automático de todas as operações de criação, edição e exclusão
- Visível apenas para administradores
- Filtros por entidade, ação, usuário e período
- Dados anteriores e novos exibidos em JSON colapsável com diff visual

### Dashboard
- Visão operacional do dia: movimentações recentes, ativos mais movimentados
- Estatísticas consolidadas: total de ativos, movimentações no período, distribuição por tipo
- Acesso rápido às últimas operações

---

## Estrutura do Projeto

```
GATI/
├── frontend/                  # React + Vite
│   └── src/
│       ├── pages/             # Ativos, Dashboard, Historico, Relatorios, Usuarios...
│       ├── components/        # Modais, tabelas, UI primitives
│       ├── contexts/          # AuthContext
│       └── lib/               # api.ts, utils.ts
│
├── backend-csharp/
│   ├── GATI.API/
│   │   ├── Controllers/       # Endpoints REST por domínio
│   │   ├── Services/          # PdfService, EmailService, AuditService, AuthService
│   │   ├── Models/            # Entidades do domínio
│   │   ├── DTOs/              # Objetos de entrada/saída
│   │   └── Data/              # IDbConnectionFactory + DbConnectionFactory
│   └── GATI.Tests/            # Testes unitários e de integração (xUnit + Moq)
│       ├── Auth/              # AuthServiceTests, LoginControllerTests
│       ├── Auditoria/         # AuditServiceTests
│       ├── Middleware/        # RequirePermissionFilterTests
│       ├── Pdf/               # PdfServiceTests
│       └── Custodia/          # CustodiaTests
│
├── docker-compose.yml         # Produção (imagens ghcr.io)
├── docker-compose.dev.yml     # Desenvolvimento (build local + live-reload)
└── DEPLOY.md                  # Guia completo de deploy
```

---

## Como Rodar

### Pré-requisitos

- Docker e Docker Compose instalados
- Arquivo `.env` na raiz do projeto com as variáveis necessárias

### Variáveis de Ambiente (`.env`)

```env
DB_CONNECTION_STRING=Driver={FreeTDS};Server=YOUR_SERVER;Port=YOUR_PORT;Database=YOUR_DB;UID=YOUR_USER;PWD=YOUR_PASSWORD;TDS_Version=7.4;
JWT_SECRET_KEY=your-jwt-secret-at-least-32-characters-long
SMTP_PASSWORD=your_smtp_app_password
SMTP_FROM=your@email.com
```

Copie `backend-csharp/GATI.API/appsettings.Example.json` para `appsettings.json` e preencha com suas credenciais.

### Desenvolvimento (live-reload)

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:80 |
| Backend (API) | http://localhost:8080 |
| Swagger | http://localhost:8080/swagger/index.html |

### Produção

```bash
docker compose up -d
```

Utiliza as imagens publicadas no GitHub Container Registry. Consulte o [`DEPLOY.md`](./DEPLOY.md) para o guia completo de deploy.

---

## Testes

### Backend — xUnit + Moq + FluentAssertions

```bash
dotnet test backend-csharp/GATI.Tests/GATI.Tests.csproj --verbosity normal

# Com relatório de cobertura
dotnet test backend-csharp/GATI.Tests/GATI.Tests.csproj \
  --collect:"XPlat Code Coverage" \
  --results-directory ./coverage-backend
```

| Módulo | Arquivo | O que cobre |
|---|---|---|
| Auth | `Auth/AuthServiceTests.cs` | Hash BCrypt, verificação de senha, geração e validação de JWT |
| Auth | `Auth/LoginControllerTests.cs` | Endpoint de login: campos obrigatórios, usuário inativo, credenciais inválidas, sucesso |
| Auditoria | `Auditoria/AuditServiceTests.cs` | Serialização JSON com remoção de base64, registro de log |
| Middleware | `Middleware/RequirePermissionFilterTests.cs` | RBAC: 401 sem auth, 403 sem permissão, 200 com permissão |
| PDF | `Pdf/PdfServiceTests.cs` | Geração de PDF sem exceção, assinatura de arquivo válida |
| Custódia | `Custodia/CustodiaTests.cs` | Fuso horário, identificação de troca de responsabilidade |

### Frontend — Jest + React Testing Library

```bash
cd frontend
npm install
npm test

# Com relatório de cobertura
npm run test:coverage
```

| Arquivo | O que cobre |
|---|---|
| `AuthContext.test.tsx` | hasPermission (admin, com/sem permissão), login/logout, refreshUser |
| `ProtectedRoute.test.tsx` | Redirecionamento para /login, renderização de conteúdo protegido, estado de loading |
| `Login.test.tsx` | Campos obrigatórios, erro de credenciais, chamada de login com sucesso |
| `Dashboard.test.tsx` | Métricas carregadas, skeleton de loading, dados vazios, sem permissão |

### CI/CD — GitHub Actions

O workflow `.github/workflows/tests.yml` executa os testes automaticamente a cada push ou Pull Request para a branch `main`, **antes** do build e push das imagens Docker.

---

## CI/CD

A cada push na branch `main`:
1. **Testes** são executados (backend + frontend) — workflow `tests.yml`
2. **Imagens Docker** são construídas e publicadas no GitHub Container Registry — workflow `deploy.yml`

---

## Banco de Dados

SQL Server via driver ODBC (FreeTDS). Configure a connection string no `.env` ou no `appsettings.json` (não versionar com credenciais reais).

---

## Licença

MIT
