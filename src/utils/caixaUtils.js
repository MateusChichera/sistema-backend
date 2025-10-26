const { pool } = require('../config/db');

/**
 * Registra uma movimentação de entrada no caixa quando um pagamento de conta a prazo é recebido
 * @param {Object} connection - Conexão do banco de dados
 * @param {number} empresaId - ID da empresa
 * @param {number} funcionarioId - ID do funcionário que recebeu o pagamento
 * @param {number} valor - Valor recebido
 * @param {number} formaPagamentoId - ID da forma de pagamento
 * @param {string} observacoes - Observações da movimentação
 * @returns {Promise<boolean>} - Retorna true se a movimentação foi registrada, false se não há caixa aberto
 */
const registrarMovimentacaoCaixaContasPrazo = async (connection, empresaId, funcionarioId, valor, formaPagamentoId, observacoes) => {
  try {
    // Verificar se há caixa aberto
    const [caixaAberto] = await connection.query(
      'SELECT id FROM caixas WHERE empresas_id = ? AND status = "Aberto" LIMIT 1',
      [empresaId]
    );

    if (caixaAberto.length === 0) {
      return false; // Não há caixa aberto
    }

    const caixaId = caixaAberto[0].id;
    
    // Registrar movimentação de entrada no caixa
    await connection.query(
      `INSERT INTO caixa_movimentacoes (
        caixa_id, empresas_id, funcionario_id, tipo_movimentacao, 
        valor, id_forma_pagamento, observacoes
      ) VALUES (?, ?, ?, 'Suprimento', ?, ?, ?)`,
      [
        caixaId, empresaId, funcionarioId, valor, 
        formaPagamentoId, observacoes
      ]
    );

    return true; // Movimentação registrada com sucesso
  } catch (error) {
    console.error('Erro ao registrar movimentação do caixa:', error);
    return false;
  }
};

/**
 * Registra movimentação de recebimento de título
 * @param {Object} connection - Conexão do banco de dados
 * @param {number} empresaId - ID da empresa
 * @param {number} funcionarioId - ID do funcionário
 * @param {number} valor - Valor recebido
 * @param {number} formaPagamentoId - ID da forma de pagamento
 * @param {string} numeroTitulo - Número do título
 * @param {string} observacoesAdicionais - Observações adicionais
 * @returns {Promise<boolean>} - Retorna true se registrado, false se não há caixa aberto
 */
const registrarRecebimentoTitulo = async (connection, empresaId, funcionarioId, valor, formaPagamentoId, numeroTitulo, observacoesAdicionais = '') => {
  const observacoes = `Recebimento de conta a prazo - Título #${numeroTitulo}${observacoesAdicionais ? ' - ' + observacoesAdicionais : ''}`;
  
  return await registrarMovimentacaoCaixaContasPrazo(
    connection, empresaId, funcionarioId, valor, formaPagamentoId, observacoes
  );
};

/**
 * Registra movimentação de recebimento inicial de pedido a prazo
 * @param {Object} connection - Conexão do banco de dados
 * @param {number} empresaId - ID da empresa
 * @param {number} funcionarioId - ID do funcionário
 * @param {number} valor - Valor recebido
 * @param {number} formaPagamentoId - ID da forma de pagamento
 * @param {number} pedidoId - ID do pedido
 * @param {string} numeroTitulo - Número do título criado
 * @returns {Promise<boolean>} - Retorna true se registrado, false se não há caixa aberto
 */
const registrarRecebimentoInicialPedido = async (connection, empresaId, funcionarioId, valor, formaPagamentoId, pedidoId, numeroTitulo) => {
  const observacoes = `Recebimento inicial conta a prazo - Pedido #${pedidoId} - Título #${numeroTitulo}`;
  
  return await registrarMovimentacaoCaixaContasPrazo(
    connection, empresaId, funcionarioId, valor, formaPagamentoId, observacoes
  );
};

/**
 * Verifica se há caixa aberto para a empresa
 * @param {Object} connection - Conexão do banco de dados
 * @param {number} empresaId - ID da empresa
 * @returns {Promise<Object|null>} - Retorna dados do caixa aberto ou null
 */
const verificarCaixaAberto = async (connection, empresaId) => {
  try {
    const [caixaAberto] = await connection.query(
      'SELECT id, numero_caixa_dia, valor_abertura FROM caixas WHERE empresas_id = ? AND status = "Aberto" LIMIT 1',
      [empresaId]
    );

    return caixaAberto.length > 0 ? caixaAberto[0] : null;
  } catch (error) {
    console.error('Erro ao verificar caixa aberto:', error);
    return null;
  }
};

module.exports = {
  registrarMovimentacaoCaixaContasPrazo,
  registrarRecebimentoTitulo,
  registrarRecebimentoInicialPedido,
  verificarCaixaAberto
};
