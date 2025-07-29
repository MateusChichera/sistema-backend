-- Script para atualizar a tabela avisos_status para incluir o novo status "Visualizar Depois"

-- 1. Alterar o ENUM da coluna status para incluir "Visualizar Depois"
ALTER TABLE `avisos_status` 
MODIFY COLUMN `status` ENUM('Não Lido', 'Lido', 'Visualizar Depois') NOT NULL DEFAULT 'Não Lido';

-- 2. Verificar se a alteração foi aplicada
DESCRIBE `avisos_status`; 