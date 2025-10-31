-- Adicionar configuração de rastreamento na tabela config_empresa
ALTER TABLE `config_empresa` 
ADD COLUMN `whatsapp_rastreamento_pedido` TINYINT(1) DEFAULT 0 COMMENT 'Permitir que cliente rastreie pedido em tempo real durante entrega';

-- Criar tabela de rastreamento de entrega
CREATE TABLE IF NOT EXISTS `rastreamento_entrega` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `pedido_id` INT NOT NULL,
  `empresa_id` INT NOT NULL,
  `status` ENUM('pendente', 'em_entrega', 'entregue', 'cancelado') DEFAULT 'pendente',
  `latitude` DECIMAL(10, 8) NULL,
  `longitude` DECIMAL(11, 8) NULL,
  `data_inicio` DATETIME NULL,
  `data_entrega` DATETIME NULL,
  `observacoes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE,
  INDEX `idx_pedido` (`pedido_id`),
  INDEX `idx_empresa` (`empresa_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Criar tabela de histórico de localização
CREATE TABLE IF NOT EXISTS `rastreamento_localizacao` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `rastreamento_id` INT NOT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`rastreamento_id`) REFERENCES `rastreamento_entrega`(`id`) ON DELETE CASCADE,
  INDEX `idx_rastreamento` (`rastreamento_id`),
  INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

