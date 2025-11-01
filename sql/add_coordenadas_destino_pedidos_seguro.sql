-- ============================================
-- Script SEGURO para adicionar campos de coordenadas do destino na tabela pedidos
-- ============================================
-- Este script verifica se os campos existem antes de adicionar
-- Execute este script no banco de dados ANTES de usar a funcionalidade de rastreamento com coordenadas
-- ============================================

-- Adicionar campos de coordenadas do destino (preferenciais)
-- Execute cada comando separadamente. Se der erro de campo duplicado, ignore e continue.

-- 1. latitude_destino
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND COLUMN_NAME = 'latitude_destino');
SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE `pedidos` ADD COLUMN `latitude_destino` DECIMAL(10, 8) NULL COMMENT ''Latitude do endereço de destino do pedido''',
                   'SELECT ''Campo latitude_destino já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. longitude_destino
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND COLUMN_NAME = 'longitude_destino');
SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE `pedidos` ADD COLUMN `longitude_destino` DECIMAL(11, 8) NULL COMMENT ''Longitude do endereço de destino do pedido''',
                   'SELECT ''Campo longitude_destino já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. latitude_entrega
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND COLUMN_NAME = 'latitude_entrega');
SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE `pedidos` ADD COLUMN `latitude_entrega` DECIMAL(10, 8) NULL COMMENT ''Latitude do endereço de entrega (alternativo)''',
                   'SELECT ''Campo latitude_entrega já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. longitude_entrega
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND COLUMN_NAME = 'longitude_entrega');
SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE `pedidos` ADD COLUMN `longitude_entrega` DECIMAL(11, 8) NULL COMMENT ''Longitude do endereço de entrega (alternativo)''',
                   'SELECT ''Campo longitude_entrega já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. endereco_latitude
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND COLUMN_NAME = 'endereco_latitude');
SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE `pedidos` ADD COLUMN `endereco_latitude` DECIMAL(10, 8) NULL COMMENT ''Latitude do endereço (alternativo)''',
                   'SELECT ''Campo endereco_latitude já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. endereco_longitude
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND COLUMN_NAME = 'endereco_longitude');
SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE `pedidos` ADD COLUMN `endereco_longitude` DECIMAL(11, 8) NULL COMMENT ''Longitude do endereço (alternativo)''',
                   'SELECT ''Campo endereco_longitude já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. lat_destino
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND COLUMN_NAME = 'lat_destino');
SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE `pedidos` ADD COLUMN `lat_destino` DECIMAL(10, 8) NULL COMMENT ''Latitude do destino (formato curto)''',
                   'SELECT ''Campo lat_destino já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. lng_destino
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND COLUMN_NAME = 'lng_destino');
SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE `pedidos` ADD COLUMN `lng_destino` DECIMAL(11, 8) NULL COMMENT ''Longitude do destino (formato curto)''',
                   'SELECT ''Campo lng_destino já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Criar índices (se não existirem)
-- 9. Índice para latitude_destino e longitude_destino
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND INDEX_NAME = 'idx_pedidos_latitude_destino');
SET @sqlstmt := IF(@exist = 0, 
                   'CREATE INDEX `idx_pedidos_latitude_destino` ON `pedidos` (`latitude_destino`, `longitude_destino`)',
                   'SELECT ''Índice idx_pedidos_latitude_destino já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 10. Índice composto para coordenadas
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pedidos' 
               AND INDEX_NAME = 'idx_pedidos_coordenadas');
SET @sqlstmt := IF(@exist = 0, 
                   'CREATE INDEX `idx_pedidos_coordenadas` ON `pedidos` (`latitude_destino`, `longitude_destino`, `latitude_entrega`, `longitude_entrega`)',
                   'SELECT ''Índice idx_pedidos_coordenadas já existe'' AS resultado');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Mensagem de conclusão
SELECT 'Script executado com sucesso! Verifique os campos criados com: DESCRIBE pedidos;' AS resultado;

