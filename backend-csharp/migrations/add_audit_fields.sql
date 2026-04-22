-- ============================================================
-- Migração: campos de auditoria por entidade
-- Tabelas: equipamento, fornecedor, localizacao, usuario, perfil
-- Seguro para produção: colunas nullable, sem rebuild de tabela,
-- sem bloqueio prolongado em SQL Server.
-- Executar manualmente no banco de dados GATI.
-- ============================================================

-- ----------------------------------------------------------------
-- equipamento
-- ----------------------------------------------------------------
ALTER TABLE equipamento ADD
    criado_por_id     INT      NULL,
    criado_em         DATETIME NULL,
    modificado_por_id INT      NULL,
    modificado_em     DATETIME NULL;
GO

ALTER TABLE equipamento ADD
    CONSTRAINT fk_equipamento_criado_por
        FOREIGN KEY (criado_por_id)     REFERENCES usuario(id),
    CONSTRAINT fk_equipamento_modificado_por
        FOREIGN KEY (modificado_por_id) REFERENCES usuario(id);
GO

-- ----------------------------------------------------------------
-- fornecedor
-- ----------------------------------------------------------------
ALTER TABLE fornecedor ADD
    criado_por_id     INT      NULL,
    criado_em         DATETIME NULL,
    modificado_por_id INT      NULL,
    modificado_em     DATETIME NULL;
GO

ALTER TABLE fornecedor ADD
    CONSTRAINT fk_fornecedor_criado_por
        FOREIGN KEY (criado_por_id)     REFERENCES usuario(id),
    CONSTRAINT fk_fornecedor_modificado_por
        FOREIGN KEY (modificado_por_id) REFERENCES usuario(id);
GO

-- ----------------------------------------------------------------
-- localizacao
-- ----------------------------------------------------------------
ALTER TABLE localizacao ADD
    criado_por_id     INT      NULL,
    criado_em         DATETIME NULL,
    modificado_por_id INT      NULL,
    modificado_em     DATETIME NULL;
GO

ALTER TABLE localizacao ADD
    CONSTRAINT fk_localizacao_criado_por
        FOREIGN KEY (criado_por_id)     REFERENCES usuario(id),
    CONSTRAINT fk_localizacao_modificado_por
        FOREIGN KEY (modificado_por_id) REFERENCES usuario(id);
GO

-- ----------------------------------------------------------------
-- usuario  (self-referencial: FK → usuario.id)
-- ----------------------------------------------------------------
ALTER TABLE usuario ADD
    criado_por_id     INT      NULL,
    criado_em         DATETIME NULL,
    modificado_por_id INT      NULL,
    modificado_em     DATETIME NULL;
GO

ALTER TABLE usuario ADD
    CONSTRAINT fk_usuario_criado_por
        FOREIGN KEY (criado_por_id)     REFERENCES usuario(id),
    CONSTRAINT fk_usuario_modificado_por
        FOREIGN KEY (modificado_por_id) REFERENCES usuario(id);
GO

-- ----------------------------------------------------------------
-- perfil
-- ----------------------------------------------------------------
ALTER TABLE perfil ADD
    criado_por_id     INT      NULL,
    criado_em         DATETIME NULL,
    modificado_por_id INT      NULL,
    modificado_em     DATETIME NULL;
GO

ALTER TABLE perfil ADD
    CONSTRAINT fk_perfil_criado_por
        FOREIGN KEY (criado_por_id)     REFERENCES usuario(id),
    CONSTRAINT fk_perfil_modificado_por
        FOREIGN KEY (modificado_por_id) REFERENCES usuario(id);
GO

-- ----------------------------------------------------------------
-- categoria
-- ----------------------------------------------------------------
ALTER TABLE categoria ADD
    criado_por_id     INT      NULL,
    criado_em         DATETIME NULL,
    modificado_por_id INT      NULL,
    modificado_em     DATETIME NULL;
GO

ALTER TABLE categoria ADD
    CONSTRAINT fk_categoria_criado_por
        FOREIGN KEY (criado_por_id)     REFERENCES usuario(id),
    CONSTRAINT fk_categoria_modificado_por
        FOREIGN KEY (modificado_por_id) REFERENCES usuario(id);
GO
