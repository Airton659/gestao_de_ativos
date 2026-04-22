---
name: project_backlog
description: Itens incompletos e sugestões de melhoria identificados na avaliação final do projeto GATI
type: project
---

## Itens Incompletos (mocks / não conectados)

- ~~**Geração de PDF do termo de movimentação**~~ ✅ **CONCLUÍDO** — PDF gerado com QuestPDF, template de termo de responsabilidade, agrupado por lote, download disponível na tela de sucesso e no histórico.

- **Envio de e-mail após movimentação** — o endpoint apenas faz `print()` com o e-mail do gestor e o path do PDF. Precisa de integração real (ex: SMTP, SendGrid ou similar).

- ~~**Log de auditoria**~~ ✅ **CONCLUÍDO** — `registrar_log()` conectado em todos os endpoints de criação, edição e exclusão (equipamentos, usuários, localizações, fornecedores, perfis, movimentações). Endpoint `GET /auditoria/` com filtros por entidade e ação. Tela Auditoria.tsx visível apenas para administradores, com JSON colapsável e badges coloridos por ação.

- ~~**Assinatura digital cadastrada no perfil**~~ ✅ **CONCLUÍDO** — Canvas à mão livre na tela de perfil (modo view/draw), salva PNG no servidor via `POST /usuarios/me/assinatura/`. PDF do termo usa as imagens automaticamente, centralizadas acima das linhas de assinatura.

- ~~**Foto do gestor na finalização da movimentação**~~ ✅ **CONCLUÍDO** — Verificação de câmera no mount do componente. Senha verificada antes de abrir câmera (`POST /verificar-senha/`). Step 5: captura de foto ao vivo via getUserMedia, preview + refazer. Upload via `POST /foto-confirmacao/{lote_id}`. Miniatura incluída no PDF. Visualização disponível no Histórico (coluna FOTO com modal).

## Sugestões de Melhoria

- **Exportar histórico** em CSV/Excel (botão na tela de Histórico)
- **Filtros avançados em Ativos** — por tipo, localização, status, fornecedor
- **Paginação real** — backend já tem `skip/limit`, frontend sempre busca tudo
- **Notificações no sistema** — ex: ativo com garantia vencendo, movimentação pendente
- **Senha forte obrigatória no backend** — hoje a validação de requisitos é só visual no front
- **Recuperação de senha por e-mail** — fluxo de "esqueci minha senha"

**Why:** Avaliação realizada em 2026-03-28 ao final do desenvolvimento inicial do sistema.
**How to apply:** Consultar antes de planejar novas features para não duplicar esforço e saber o que já existe (mesmo que incompleto).
