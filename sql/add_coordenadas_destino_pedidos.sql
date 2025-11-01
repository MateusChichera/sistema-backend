-- ============================================
-- Adicionar campos de coordenadas do destino na tabela pedidos
-- ============================================
-- Execute este script no banco de dados ANTES de usar a funcionalidade de rastreamento com coordenadas
-- 
-- Este script adiciona campos para armazenar as coordenadas (latitude/longitude) do endereço de destino
-- do pedido. Esses campos são necessários para posicionar o pin no mapa de rastreamento público.
--
-- IMPORTANTE: Execute este script UMA VEZ no banco de dados antes de criar novos pedidos
-- ============================================

-- Verificar e adicionar campos de coordenadas do destino (preferenciais)
-- IMPORTANTE: MySQL não suporta IF NOT EXISTS em ALTER TABLE
-- Se os campos já existirem, você receberá um erro. Isso é seguro - apenas ignore o erro ou execute
-- os comandos um por um, pulando os campos que já existem.

-- Adicionar campos de coordenadas do destino (preferenciais)
ALTER TABLE `pedidos` 
ADD COLUMN `latitude_destino` DECIMAL(10, 8) NULL COMMENT 'Latitude do endereço de destino do pedido';

ALTER TABLE `pedidos` 
ADD COLUMN `longitude_destino` DECIMAL(11, 8) NULL COMMENT 'Longitude do endereço de destino do pedido';

-- Adicionar campos alternativos para compatibilidade (caso o frontend use nomes diferentes)
ALTER TABLE `pedidos` 
ADD COLUMN `latitude_entrega` DECIMAL(10, 8) NULL COMMENT 'Latitude do endereço de entrega (alternativo)';

ALTER TABLE `pedidos` 
ADD COLUMN `longitude_entrega` DECIMAL(11, 8) NULL COMMENT 'Longitude do endereço de entrega (alternativo)';

-- Adicionar campos alternativos adicionais
ALTER TABLE `pedidos` 
ADD COLUMN `endereco_latitude` DECIMAL(10, 8) NULL COMMENT 'Latitude do endereço (alternativo)';

ALTER TABLE `pedidos` 
ADD COLUMN `endereco_longitude` DECIMAL(11, 8) NULL COMMENT 'Longitude do endereço (alternativo)';

-- Adicionar campos alternativos adicionais (formato curto)
ALTER TABLE `pedidos` 
ADD COLUMN `lat_destino` DECIMAL(10, 8) NULL COMMENT 'Latitude do destino (formato curto)';

ALTER TABLE `pedidos` 
ADD COLUMN `lng_destino` DECIMAL(11, 8) NULL COMMENT 'Longitude do destino (formato curto)';

-- Criar índices para melhor performance em buscas por coordenadas
-- Nota: Se os índices já existirem, você receberá um erro. Isso é seguro - apenas ignore.
CREATE INDEX `idx_pedidos_latitude_destino` ON `pedidos` (`latitude_destino`, `longitude_destino`);
CREATE INDEX `idx_pedidos_coordenadas` ON `pedidos` (`latitude_destino`, `longitude_destino`, `latitude_entrega`, `longitude_entrega`);

