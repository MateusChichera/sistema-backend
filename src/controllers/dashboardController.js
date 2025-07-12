// backend/src/controllers/dashboardController.js
const { pool } = require('../config/db');

// Obter dados para o Dashboard de uma empresa
const getDashboardData = async (req, res, next) => {
  const empresaId = req.empresa_id; // Vem do extractEmpresaId
  const requestingUserRole = req.user.role;

  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  // Apenas Proprietário e Gerente podem ver o dashboard completo
  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar o dashboard.' });
  }

  try {
    // 1. Total de pedidos por status e tipo
    const [pedidosOverview] = await pool.query(
      `SELECT status, tipo_entrega, total_pedidos, valor_total_pedidos 
       FROM total_pedidos_por_status_e_tipo 
       WHERE empresa_id = ?`, 
      [empresaId]
    );

    // 2. Vendas por dia (últimos 7 dias, ou ajuste conforme necessidade)
    const [vendasPorDia] = await pool.query(
      `SELECT data, total_pedidos, vendas_total, ticket_medio 
       FROM vendas_por_dia 
       WHERE empresa_id = ? AND data >= CURDATE() - INTERVAL 7 DAY
       ORDER BY data ASC`,
      [empresaId]
    );

    // 3. Produtos mais vendidos (top 5 ou top 10)
    const [produtosMaisVendidos] = await pool.query(
      `SELECT produto_nome, quantidade_vendida, valor_total 
       FROM produtos_mais_vendidos 
       WHERE empresa_id = ? LIMIT 5`,
      [empresaId]
    );

    // 4. Receita Total (exemplo simples, pode ser mais complexo com filtros de data)
    const [receitaTotalResult] = await pool.query(
        `SELECT SUM(valor_pago) as receita_total FROM pagamentos WHERE empresa_id = ?`,
        [empresaId]
    );
    const receitaTotal = receitaTotalResult[0].receita_total || 0;

    // 5. Total de pedidos ativos (Pendente, Preparando, Pronto)
    const [pedidosAtivosCount] = await pool.query(
        `SELECT COUNT(id) as count FROM pedidos WHERE empresa_id = ? AND status IN ('Pendente', 'Preparando', 'Pronto')`,
        [empresaId]
    );
    const totalPedidosAtivos = pedidosAtivosCount[0].count;


    res.status(200).json({
      pedidosOverview,
      vendasPorDia,
      produtosMaisVendidos,
      receitaTotal: parseFloat(receitaTotal),
      totalPedidosAtivos
    });

  } catch (error) {
    next(error);
  }
};

// Obter relatório de Acessos x Pedidos por período (cardápio digital)
const getRelatorioAcessosPedidos = async (req, res, next) => {
  const empresaId = req.empresa_id; // Definido pelo middleware extractEmpresaId
  const requestingUserRole = req.user.role;

  // Validações básicas
  if (!empresaId) {
    return res.status(500).json({ message: 'Erro interno: ID da empresa não encontrado na requisição.' });
  }

  if (requestingUserRole !== 'Proprietario' && requestingUserRole !== 'Gerente') {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar este relatório.' });
  }

  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Parâmetros startDate e endDate são obrigatórios no formato YYYY-MM-DD.' });
  }

  try {
    const [relatorio] = await pool.query(
      `SELECT data_relatorio, total_acessos, total_pedidos, taxa_conversao_percentual
       FROM relatorio_acessos_pedidos_diario
       WHERE empresas_id = ? AND data_relatorio BETWEEN ? AND ?
       ORDER BY data_relatorio ASC`,
      [empresaId, startDate, endDate]
    );

    res.status(200).json(relatorio);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardData,
  getRelatorioAcessosPedidos,
};