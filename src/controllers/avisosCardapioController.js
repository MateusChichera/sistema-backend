const { pool } = require('../config/db');

// =====================================================
// CONTROLLER PARA AVISOS DO CARDÁPIO
// =====================================================

// 1. Listar todos os avisos do cardápio
const getAllAvisosCardapio = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const { ativo, tipo, prioridade } = req.query;

  try {
    let query = `
      SELECT 
        id,
        titulo,
        mensagem,
        tipo,
        prioridade,
        dias_semana,
        ativo,
        data_criacao,
        data_atualizacao
      FROM avisos_cardapio 
      WHERE empresa_id = ?
    `;
    
    const params = [empresaId];

    // Filtros opcionais
    if (ativo !== undefined) {
      query += ' AND ativo = ?';
      params.push(ativo === 'true' ? 1 : 0);
    }

    if (tipo) {
      query += ' AND tipo = ?';
      params.push(tipo);
    }

    if (prioridade) {
      query += ' AND prioridade = ?';
      params.push(parseInt(prioridade));
    }

    query += ' ORDER BY prioridade DESC, data_criacao DESC';

    const [avisos] = await pool.query(query, params);
    res.status(200).json(avisos);
  } catch (error) {
    next(error);
  }
};

// 2. Buscar aviso por ID
const getAvisoCardapioById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;

  try {
    const [avisos] = await pool.query(
      `SELECT 
        id,
        titulo,
        mensagem,
        tipo,
        prioridade,
        dias_semana,
        ativo,
        data_criacao,
        data_atualizacao
      FROM avisos_cardapio 
      WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    if (avisos.length === 0) {
      return res.status(404).json({ message: 'Aviso não encontrado.' });
    }

    res.status(200).json(avisos[0]);
  } catch (error) {
    next(error);
  }
};

// 3. Criar novo aviso do cardápio
const createAvisoCardapio = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const { titulo, mensagem, tipo, prioridade, dias_semana } = req.body;

  if (!titulo || !mensagem) {
    return res.status(400).json({ 
      message: 'Título e mensagem são obrigatórios.' 
    });
  }

  if (!['Proprietario', 'Gerente'].includes(req.user.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem criar avisos.' 
    });
  }

  try {
    // Validar dias da semana se fornecidos
    if (dias_semana && Array.isArray(dias_semana)) {
      const diasValidos = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
      const diasInvalidos = dias_semana.filter(dia => !diasValidos.includes(dia));
      if (diasInvalidos.length > 0) {
        return res.status(400).json({ 
          message: `Dias da semana inválidos: ${diasInvalidos.join(', ')}. Use: segunda, terca, quarta, quinta, sexta, sabado, domingo` 
        });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO avisos_cardapio (
        empresa_id, titulo, mensagem, tipo, prioridade, dias_semana, ativo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        titulo,
        mensagem,
        tipo || 'info',
        prioridade || 1,
        dias_semana ? JSON.stringify(dias_semana) : null,
        1
      ]
    );

    res.status(201).json({
      message: 'Aviso criado com sucesso!',
      aviso: {
        id: result.insertId,
        titulo,
        mensagem,
        tipo: tipo || 'info',
        prioridade: prioridade || 1,
        dias_semana: dias_semana || null,
        ativo: true
      }
    });
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar aviso do cardápio
const updateAvisoCardapio = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const { titulo, mensagem, tipo, prioridade, dias_semana, ativo } = req.body;

  if (!['Proprietario', 'Gerente'].includes(req.user.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem editar avisos.' 
    });
  }

  try {
    // Verificar se o aviso existe
    const [avisos] = await pool.query(
      'SELECT id FROM avisos_cardapio WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (avisos.length === 0) {
      return res.status(404).json({ message: 'Aviso não encontrado.' });
    }

    // Validar dias da semana se fornecidos
    if (dias_semana && Array.isArray(dias_semana)) {
      const diasValidos = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
      const diasInvalidos = dias_semana.filter(dia => !diasValidos.includes(dia));
      if (diasInvalidos.length > 0) {
        return res.status(400).json({ 
          message: `Dias da semana inválidos: ${diasInvalidos.join(', ')}. Use: segunda, terca, quarta, quinta, sexta, sabado, domingo` 
        });
      }
    }

    // Construir query de atualização dinamicamente
    const updates = [];
    const params = [];

    if (titulo !== undefined) {
      updates.push('titulo = ?');
      params.push(titulo);
    }
    if (mensagem !== undefined) {
      updates.push('mensagem = ?');
      params.push(mensagem);
    }
    if (tipo !== undefined) {
      updates.push('tipo = ?');
      params.push(tipo);
    }
    if (prioridade !== undefined) {
      updates.push('prioridade = ?');
      params.push(prioridade);
    }
    if (dias_semana !== undefined) {
      updates.push('dias_semana = ?');
      params.push(dias_semana ? JSON.stringify(dias_semana) : null);
    }
    if (ativo !== undefined) {
      updates.push('ativo = ?');
      params.push(ativo ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
    }

    updates.push('data_atualizacao = CURRENT_TIMESTAMP');
    params.push(id, empresaId);

    await pool.query(
      `UPDATE avisos_cardapio SET ${updates.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );

    res.status(200).json({ message: 'Aviso atualizado com sucesso!' });
  } catch (error) {
    next(error);
  }
};

// 5. Excluir aviso do cardápio
const deleteAvisoCardapio = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;

  if (!['Proprietario', 'Gerente'].includes(req.user.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem excluir avisos.' 
    });
  }

  try {
    const [result] = await pool.query(
      'DELETE FROM avisos_cardapio WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Aviso não encontrado.' });
    }

    res.status(200).json({ message: 'Aviso excluído com sucesso!' });
  } catch (error) {
    next(error);
  }
};

// 6. Ativar/Desativar aviso do cardápio
const toggleAvisoCardapio = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const { ativo } = req.body;

  if (!['Proprietario', 'Gerente'].includes(req.user.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem ativar/desativar avisos.' 
    });
  }

  try {
    const [result] = await pool.query(
      'UPDATE avisos_cardapio SET ativo = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?',
      [ativo ? 1 : 0, id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Aviso não encontrado.' });
    }

    res.status(200).json({ 
      message: `Aviso ${ativo ? 'ativado' : 'desativado'} com sucesso!` 
    });
  } catch (error) {
    next(error);
  }
};

// 7. Buscar avisos do dia atual (para cardápio público)
const getAvisosDiaAtual = async (req, res, next) => {
  const empresaId = req.empresa_id;

  try {
    // Mapear dia da semana atual
    const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const diaAtual = diasSemana[new Date().getDay()];

    const [avisos] = await pool.query(
      `SELECT 
        id,
        titulo,
        mensagem,
        tipo,
        prioridade,
        dias_semana
      FROM avisos_cardapio 
      WHERE empresa_id = ? 
        AND ativo = 1
        AND (dias_semana IS NULL OR JSON_CONTAINS(dias_semana, JSON_QUOTE(?)))
      ORDER BY prioridade DESC, data_criacao ASC`,
      [empresaId, diaAtual]
    );

    res.status(200).json(avisos);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAvisosCardapio,
  getAvisoCardapioById,
  createAvisoCardapio,
  updateAvisoCardapio,
  deleteAvisoCardapio,
  toggleAvisoCardapio,
  getAvisosDiaAtual
};
