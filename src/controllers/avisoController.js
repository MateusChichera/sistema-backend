const { pool } = require('../config/db');

// 1. Criar um novo aviso (apenas admin do sistema)
const createAviso = async (req, res, next) => {
  const { titulo, mensagem } = req.body;
  const requestingUserRole = req.user.role;

  if (!titulo || !mensagem) {
    return res.status(400).json({ message: 'Título e mensagem são obrigatórios.' });
  }

  // Apenas admin do sistema pode criar avisos
  if (requestingUserRole !== 'admin_geral') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o administrador do sistema pode criar avisos.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO avisos (titulo, mensagem) VALUES (?, ?)`,
      [titulo, mensagem]
    );

    const avisoId = result.insertId;

    // Criar registros de status para todos os funcionários de todas as empresas
    const [funcionarios] = await pool.query(
      `SELECT id FROM funcionarios WHERE ativo = true`
    );

    if (funcionarios.length > 0) {
      const statusValues = funcionarios.map(func => `(${avisoId}, ${func.id}, 'Não Lido')`).join(',');
      await pool.query(
        `INSERT INTO avisos_status (aviso_id, funcionario_id, status) VALUES ${statusValues}`
      );
    }

    res.status(201).json({
      message: 'Aviso criado com sucesso!',
      aviso: {
        id: avisoId,
        titulo,
        mensagem,
        data_criacao: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

// 2. Listar todos os avisos (globais para todas as empresas)
const getAllAvisos = async (req, res, next) => {
  const funcionarioId = req.user.id;
  const requestingUserRole = req.user.role;

  // Todos os funcionários podem visualizar avisos
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa', 'admin_geral'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar avisos.' });
  }

  try {
    const [avisos] = await pool.query(
      `SELECT 
        a.id, 
        a.titulo, 
        a.mensagem, 
        a.data_criacao,
        COALESCE(avs.status, 'Não Lido') as status,
        avs.data_alteracao
      FROM avisos a
      LEFT JOIN avisos_status avs ON a.id = avs.aviso_id AND avs.funcionario_id = ?
      ORDER BY a.data_criacao DESC`,
      [funcionarioId]
    );

    res.status(200).json({
      message: 'Avisos listados com sucesso!',
      avisos
    });
  } catch (error) {
    next(error);
  }
};

// 3. Obter aviso por ID
const getAvisoById = async (req, res, next) => {
  const { id } = req.params;
  const funcionarioId = req.user.id;
  const requestingUserRole = req.user.role;

  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa', 'admin_geral'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar avisos.' });
  }

  try {
    const [avisos] = await pool.query(
      `SELECT 
        a.id, 
        a.titulo, 
        a.mensagem, 
        a.data_criacao,
        COALESCE(avs.status, 'Não Lido') as status,
        avs.data_alteracao
      FROM avisos a
      LEFT JOIN avisos_status avs ON a.id = avs.aviso_id AND avs.funcionario_id = ?
      WHERE a.id = ?`,
      [funcionarioId, id]
    );

    if (avisos.length === 0) {
      return res.status(404).json({ message: 'Aviso não encontrado.' });
    }

    res.status(200).json({
      message: 'Aviso encontrado com sucesso!',
      aviso: avisos[0]
    });
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar aviso (apenas admin do sistema)
const updateAviso = async (req, res, next) => {
  const { id } = req.params;
  const { titulo, mensagem } = req.body;
  const requestingUserRole = req.user.role;

  if (!titulo || !mensagem) {
    return res.status(400).json({ message: 'Título e mensagem são obrigatórios.' });
  }

  // Apenas admin do sistema pode atualizar avisos
  if (requestingUserRole !== 'admin_geral') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o administrador do sistema pode atualizar avisos.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE avisos SET titulo = ?, mensagem = ? WHERE id = ?`,
      [titulo, mensagem, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Aviso não encontrado.' });
    }

    res.status(200).json({
      message: 'Aviso atualizado com sucesso!',
      aviso: {
        id: parseInt(id),
        titulo,
        mensagem
      }
    });
  } catch (error) {
    next(error);
  }
};

// 5. Excluir aviso (apenas admin do sistema)
const deleteAviso = async (req, res, next) => {
  const { id } = req.params;
  const requestingUserRole = req.user.role;

  // Apenas admin do sistema pode excluir avisos
  if (requestingUserRole !== 'admin_geral') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o administrador do sistema pode excluir avisos.' });
  }

  try {
    const [result] = await pool.query(
      `DELETE FROM avisos WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Aviso não encontrado.' });
    }

    res.status(200).json({
      message: 'Aviso excluído com sucesso!'
    });
  } catch (error) {
    next(error);
  }
};

// 6. Atualizar status do aviso (marcar como lido/não lido)
const updateAvisoStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  const funcionarioId = req.user.id;
  const requestingUserRole = req.user.role;

  if (!status || !['Lido', 'Não Lido', 'Visualizar Depois'].includes(status)) {
    return res.status(400).json({ message: 'Status deve ser "Lido", "Não Lido" ou "Visualizar Depois".' });
  }

  // Todos os funcionários podem atualizar o status dos avisos
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa', 'admin_geral'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para atualizar status de avisos.' });
  }

  try {
    // Verificar se o aviso existe
    const [avisos] = await pool.query(
      `SELECT id FROM avisos WHERE id = ?`,
      [id]
    );

    if (avisos.length === 0) {
      return res.status(404).json({ message: 'Aviso não encontrado.' });
    }

    // Atualizar ou inserir status
    await pool.query(
      `INSERT INTO avisos_status (aviso_id, funcionario_id, status) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE status = ?, data_alteracao = CURRENT_TIMESTAMP`,
      [id, funcionarioId, status, status]
    );

    res.status(200).json({
      message: 'Status do aviso atualizado com sucesso!',
      status
    });
  } catch (error) {
    next(error);
  }
};

// 7. Verificar se há avisos não lidos para o funcionário
const checkAvisosNaoLidos = async (req, res, next) => {
  const funcionarioId = req.user.id;
  const requestingUserRole = req.user.role;

  // Todos os funcionários podem verificar avisos não lidos
  if (!['Proprietario', 'Gerente', 'Funcionario', 'Caixa', 'admin_geral'].includes(requestingUserRole)) {
    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para verificar avisos.' });
  }

  try {
    const [avisos] = await pool.query(
      `SELECT 
        a.id, 
        a.titulo, 
        a.mensagem, 
        a.data_criacao,
        COALESCE(avs.status, 'Não Lido') as status,
        avs.data_alteracao
      FROM avisos a
      LEFT JOIN avisos_status avs ON a.id = avs.aviso_id AND avs.funcionario_id = ?
      WHERE COALESCE(avs.status, 'Não Lido') IN ('Não Lido', 'Visualizar Depois')
      ORDER BY a.data_criacao DESC`,
      [funcionarioId]
    );

    res.status(200).json({
      message: 'Verificação de avisos realizada com sucesso!',
      tem_avisos_nao_lidos: avisos.length > 0,
      total_nao_lidos: avisos.length,
      avisos: avisos
    });
  } catch (error) {
    next(error);
  }
};

// 9. Listar todos os avisos com detalhes por empresa (apenas admin)
const getAllAvisosWithDetails = async (req, res, next) => {
  const requestingUserRole = req.user.role;

  // Apenas admin do sistema pode visualizar detalhes completos
  if (requestingUserRole !== 'admin_geral') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o administrador do sistema pode visualizar detalhes dos avisos.' });
  }

  try {
    // Primeiro, buscar todos os avisos
    const [avisosData] = await pool.query(
      `SELECT id, titulo, mensagem, data_criacao FROM avisos ORDER BY data_criacao DESC`
    );

    // Para cada aviso, buscar detalhes por empresa
    const resultado = [];
    
    for (const aviso of avisosData) {
      // Buscar empresas e funcionários para este aviso
      const [detalhes] = await pool.query(
        `SELECT 
          e.id as empresa_id,
          e.nome_fantasia as empresa_nome,
          e.slug as empresa_slug,
          f.id as funcionario_id,
          f.nome as funcionario_nome,
          f.email as funcionario_email,
          f.role as funcionario_role,
          COALESCE(avs.status, 'Não Lido') as status,
          avs.data_alteracao
        FROM empresas e
        LEFT JOIN funcionarios f ON f.empresa_id = e.id AND f.ativo = true
        LEFT JOIN avisos_status avs ON avs.aviso_id = ? AND avs.funcionario_id = f.id
        ORDER BY e.nome_fantasia, f.nome`,
        [aviso.id]
      );

      // Agrupar por empresa
      const empresas = {};
      
      detalhes.forEach(row => {
        const empresaId = row.empresa_id;
        
        if (!empresas[empresaId]) {
          empresas[empresaId] = {
            id: empresaId,
            nome: row.empresa_nome,
            slug: row.empresa_slug,
            funcionarios: []
          };
        }
        
        if (row.funcionario_id) {
          empresas[empresaId].funcionarios.push({
            id: row.funcionario_id,
            nome: row.funcionario_nome,
            email: row.funcionario_email,
            role: row.funcionario_role,
            status: row.status,
            data_alteracao: row.data_alteracao
          });
        }
      });

      // Calcular estatísticas por empresa
      const empresasArray = Object.values(empresas);
      empresasArray.forEach(empresa => {
        const totalFuncionarios = empresa.funcionarios.length;
        const lidos = empresa.funcionarios.filter(f => f.status === 'Lido').length;
        const naoLidos = totalFuncionarios - lidos;
        
        empresa.estatisticas = {
          total_funcionarios: totalFuncionarios,
          lidos: lidos,
          nao_lidos: naoLidos,
          percentual_lidos: totalFuncionarios > 0 ? Math.round((lidos / totalFuncionarios) * 100) : 0
        };
      });

      // Calcular estatísticas gerais do aviso
      const totalEmpresas = empresasArray.length;
      const totalFuncionarios = empresasArray.reduce((sum, emp) => sum + emp.estatisticas.total_funcionarios, 0);
      const totalLidos = empresasArray.reduce((sum, emp) => sum + emp.estatisticas.lidos, 0);
      const totalNaoLidos = totalFuncionarios - totalLidos;

      resultado.push({
        id: aviso.id,
        titulo: aviso.titulo,
        mensagem: aviso.mensagem,
        data_criacao: aviso.data_criacao,
        empresas: empresasArray,
        estatisticas_gerais: {
          total_empresas: totalEmpresas,
          total_funcionarios: totalFuncionarios,
          total_lidos: totalLidos,
          total_nao_lidos: totalNaoLidos,
          percentual_lidos: totalFuncionarios > 0 ? Math.round((totalLidos / totalFuncionarios) * 100) : 0
        }
      });
    }

    res.status(200).json({
      message: 'Avisos com detalhes listados com sucesso!',
      avisos: resultado,
      total_avisos: resultado.length
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAviso,
  getAllAvisos,
  getAvisoById,
  updateAviso,
  deleteAviso,
  updateAvisoStatus,
  checkAvisosNaoLidos,
  getAllAvisosWithDetails
};
