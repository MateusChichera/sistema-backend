const { pool } = require('../config/db');

// =====================================================
// CONTROLLER PARA GERENCIAMENTO DE ENDEREÇOS
// =====================================================

// 1. Criar novo endereço
const createEndereco = async (req, res, next) => {
  const {
    nome,
    endereco_completo,
    cidade,
    estado,
    cep,
    telefone,
    email
  } = req.body;

  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!nome || !endereco_completo) {
    return res.status(400).json({ 
      message: 'Nome e endereço completo são obrigatórios.' 
    });
  }

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem gerenciar endereços.' 
    });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO empresa_enderecos (
        empresa_id, nome, endereco_completo, cidade, estado, cep, telefone, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, nome, endereco_completo, cidade || null, estado || null, 
       cep || null, telefone || null, email || null]
    );

    res.status(201).json({
      message: 'Endereço criado com sucesso!',
      endereco: {
        id: result.insertId,
        nome,
        endereco_completo
      }
    });

  } catch (error) {
    next(error);
  }
};

// 2. Listar endereços da empresa
const getAllEnderecos = async (req, res, next) => {
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const { ativo } = req.query;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar endereços.' 
    });
  }

  let query = `
    SELECT 
      id, nome, endereco_completo, cidade, estado, cep, 
      telefone, email, ativo, data_criacao, data_atualizacao
    FROM empresa_enderecos 
    WHERE empresa_id = ?
  `;
  
  const params = [empresaId];

  if (ativo !== undefined) {
    query += ' AND ativo = ?';
    params.push(ativo === 'true' ? 1 : 0);
  }

  query += ' ORDER BY nome ASC';

  try {
    const [enderecos] = await pool.query(query, params);
    res.status(200).json(enderecos);
  } catch (error) {
    next(error);
  }
};

// 3. Obter endereço por ID
const getEnderecoById = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar este endereço.' 
    });
  }

  try {
    const [enderecoRows] = await pool.query(
      `SELECT 
        id, nome, endereco_completo, cidade, estado, cep, 
        telefone, email, ativo, data_criacao, data_atualizacao
       FROM empresa_enderecos 
       WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.status(404).json({ message: 'Endereço não encontrado.' });
    }

    res.status(200).json(enderecoRows[0]);
  } catch (error) {
    next(error);
  }
};

// 4. Atualizar endereço
const updateEndereco = async (req, res, next) => {
  const { id } = req.params;
  const {
    nome,
    endereco_completo,
    cidade,
    estado,
    cep,
    telefone,
    email,
    ativo
  } = req.body;

  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem atualizar endereços.' 
    });
  }

  try {
    const [result] = await pool.query(
      `UPDATE empresa_enderecos SET 
        nome = ?, endereco_completo = ?, cidade = ?, estado = ?, 
        cep = ?, telefone = ?, email = ?, ativo = ?, 
        data_atualizacao = CURRENT_TIMESTAMP
       WHERE id = ? AND empresa_id = ?`,
      [nome, endereco_completo, cidade, estado, cep, telefone, email, ativo, id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Endereço não encontrado.' });
    }

    res.status(200).json({ message: 'Endereço atualizado com sucesso!' });
  } catch (error) {
    next(error);
  }
};

// 5. Deletar endereço
const deleteEndereco = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem deletar endereços.' 
    });
  }

  try {
    const [result] = await pool.query(
      'DELETE FROM empresa_enderecos WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Endereço não encontrado.' });
    }

    res.status(200).json({ message: 'Endereço deletado com sucesso!' });
  } catch (error) {
    next(error);
  }
};

// 6. Adicionar dia da semana de funcionamento ao endereço
const addDiaSemana = async (req, res, next) => {
  const { id } = req.params;
  const {
    dia_semana,
    horario_inicio,
    horario_fim,
    observacoes
  } = req.body;

  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!dia_semana) {
    return res.status(400).json({ 
      message: 'Dia da semana é obrigatório.' 
    });
  }

  const diasValidos = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  if (!diasValidos.includes(dia_semana)) {
    return res.status(400).json({ 
      message: 'Dia da semana inválido. Use: segunda, terca, quarta, quinta, sexta, sabado, domingo' 
    });
  }

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem gerenciar dias de funcionamento.' 
    });
  }

  try {
    // Verificar se o endereço pertence à empresa
    const [enderecoRows] = await pool.query(
      'SELECT id FROM empresa_enderecos WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.status(404).json({ message: 'Endereço não encontrado.' });
    }

    const [result] = await pool.query(
      `INSERT INTO endereco_dias_semana (
        endereco_id, dia_semana, horario_inicio, horario_fim, observacoes
      ) VALUES (?, ?, ?, ?, ?)`,
      [id, dia_semana, horario_inicio || null, horario_fim || null, observacoes || null]
    );

    res.status(201).json({
      message: 'Dia da semana adicionado com sucesso!',
      dia_semana: {
        id: result.insertId,
        dia_semana,
        horario_inicio,
        horario_fim
      }
    });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        message: 'Já existe um registro para este endereço neste dia da semana.' 
      });
    }
    next(error);
  }
};

// 7. Listar dias da semana de funcionamento do endereço
const getDiasSemana = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const { dia_semana } = req.query;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar dias de funcionamento.' 
    });
  }

  try {
    // Verificar se o endereço pertence à empresa
    const [enderecoRows] = await pool.query(
      'SELECT id FROM empresa_enderecos WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.status(404).json({ message: 'Endereço não encontrado.' });
    }

    let query = `
      SELECT 
        id, dia_semana, horario_inicio, horario_fim, 
        observacoes, ativo, data_criacao
      FROM endereco_dias_semana 
      WHERE endereco_id = ?
    `;
    
    const params = [id];

    if (dia_semana) {
      query += ' AND dia_semana = ?';
      params.push(dia_semana);
    }

    query += ' ORDER BY FIELD(dia_semana, "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo")';

    const [dias] = await pool.query(query, params);
    res.status(200).json(dias);
  } catch (error) {
    next(error);
  }
};

// 8. Atualizar dia da semana de um endereço
const updateDiaSemana = async (req, res, next) => {
  const { id: enderecoId, diaId } = req.params;
  const { dia_semana, horario_inicio, horario_fim, observacoes, ativo } = req.body;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem atualizar dias da semana.' 
    });
  }

  // Validar dia da semana
  const diasValidos = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  if (dia_semana && !diasValidos.includes(dia_semana)) {
    return res.status(400).json({ 
      message: 'Dia da semana inválido. Use: segunda, terca, quarta, quinta, sexta, sabado, domingo' 
    });
  }

  try {
    // Verificar se o endereço existe e pertence à empresa
    const [enderecoRows] = await pool.query(
      'SELECT id FROM empresa_enderecos WHERE id = ? AND empresa_id = ? AND ativo = TRUE',
      [enderecoId, empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.status(404).json({ message: 'Endereço não encontrado.' });
    }

    // Verificar se o dia da semana existe
    const [diaRows] = await pool.query(
      'SELECT id FROM endereco_dias_semana WHERE id = ? AND endereco_id = ?',
      [diaId, enderecoId]
    );

    if (diaRows.length === 0) {
      return res.status(404).json({ message: 'Dia da semana não encontrado.' });
    }

    // Se está mudando o dia da semana, verificar se já existe outro registro com o mesmo dia
    if (dia_semana) {
      const [diaExistente] = await pool.query(
        'SELECT id FROM endereco_dias_semana WHERE endereco_id = ? AND dia_semana = ? AND id != ?',
        [enderecoId, dia_semana, diaId]
      );

      if (diaExistente.length > 0) {
        return res.status(400).json({ 
          message: `Já existe um registro para ${dia_semana} neste endereço.` 
        });
      }
    }

    // Preparar campos para atualização
    const camposAtualizacao = [];
    const valores = [];

    if (dia_semana !== undefined) {
      camposAtualizacao.push('dia_semana = ?');
      valores.push(dia_semana);
    }
    if (horario_inicio !== undefined) {
      camposAtualizacao.push('horario_inicio = ?');
      valores.push(horario_inicio);
    }
    if (horario_fim !== undefined) {
      camposAtualizacao.push('horario_fim = ?');
      valores.push(horario_fim);
    }
    if (observacoes !== undefined) {
      camposAtualizacao.push('observacoes = ?');
      valores.push(observacoes);
    }
    if (ativo !== undefined) {
      camposAtualizacao.push('ativo = ?');
      valores.push(ativo);
    }

    if (camposAtualizacao.length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar foi fornecido.' });
    }

    // Adicionar data de atualização
    camposAtualizacao.push('data_atualizacao = CURRENT_TIMESTAMP');
    valores.push(diaId, enderecoId);

    // Atualizar o dia da semana
    await pool.query(
      `UPDATE endereco_dias_semana SET ${camposAtualizacao.join(', ')} WHERE id = ? AND endereco_id = ?`,
      valores
    );

    res.status(200).json({ message: 'Dia da semana atualizado com sucesso!' });
  } catch (error) {
    next(error);
  }
};

// 9. Excluir dia da semana de um endereço
const deleteDiaSemana = async (req, res, next) => {
  const { id: enderecoId, diaId } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem excluir dias da semana.' 
    });
  }

  try {
    // Verificar se o endereço existe e pertence à empresa
    const [enderecoRows] = await pool.query(
      'SELECT id FROM empresa_enderecos WHERE id = ? AND empresa_id = ? AND ativo = TRUE',
      [enderecoId, empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.status(404).json({ message: 'Endereço não encontrado.' });
    }

    // Verificar se o dia da semana existe
    const [diaRows] = await pool.query(
      'SELECT id FROM endereco_dias_semana WHERE id = ? AND endereco_id = ?',
      [diaId, enderecoId]
    );

    if (diaRows.length === 0) {
      return res.status(404).json({ message: 'Dia da semana não encontrado.' });
    }

    // Excluir o dia da semana
    await pool.query(
      'DELETE FROM endereco_dias_semana WHERE id = ? AND endereco_id = ?',
      [diaId, enderecoId]
    );

    res.status(200).json({ message: 'Dia da semana excluído com sucesso!' });
  } catch (error) {
    next(error);
  }
};

// 9. Obter endereço ativo do dia atual
const getEnderecoDiaAtual = async (req, res, next) => {
  const empresaId = req.empresa_id;

  try {
    const [enderecoRows] = await pool.query(
      `SELECT 
        eds.id,
        eds.endereco_id,
        eds.dia_semana,
        eds.horario_inicio,
        eds.horario_fim,
        eds.observacoes,
        ee.nome AS endereco_nome,
        ee.endereco_completo,
        ee.cidade,
        ee.estado,
        ee.cep,
        ee.telefone,
        ee.email
       FROM endereco_dias_semana eds
       JOIN empresa_enderecos ee ON eds.endereco_id = ee.id
       WHERE eds.dia_semana = CASE 
         WHEN DAYOFWEEK(CURDATE()) = 1 THEN 'domingo'
         WHEN DAYOFWEEK(CURDATE()) = 2 THEN 'segunda'
         WHEN DAYOFWEEK(CURDATE()) = 3 THEN 'terca'
         WHEN DAYOFWEEK(CURDATE()) = 4 THEN 'quarta'
         WHEN DAYOFWEEK(CURDATE()) = 5 THEN 'quinta'
         WHEN DAYOFWEEK(CURDATE()) = 6 THEN 'sexta'
         WHEN DAYOFWEEK(CURDATE()) = 7 THEN 'sabado'
       END
       AND eds.ativo = TRUE
       AND ee.ativo = TRUE
       AND ee.empresa_id = ?
       ORDER BY eds.data_criacao ASC
       LIMIT 1`,
      [empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.status(404).json({ 
        message: 'Nenhum endereço ativo encontrado para hoje.' 
      });
    }

    res.status(200).json(enderecoRows[0]);
  } catch (error) {
    next(error);
  }
};

// 9. Criar aviso para endereço
const createAviso = async (req, res, next) => {
  const { id } = req.params;
  const {
    titulo,
    mensagem,
    tipo,
    dias_semana,
    horario_inicio,
    horario_fim,
    prioridade
  } = req.body;

  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!titulo || !mensagem) {
    return res.status(400).json({ 
      message: 'Título e mensagem são obrigatórios.' 
    });
  }

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem criar avisos.' 
    });
  }

  try {
    // Verificar se o endereço pertence à empresa
    const [enderecoRows] = await pool.query(
      'SELECT id FROM empresa_enderecos WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.status(404).json({ message: 'Endereço não encontrado.' });
    }

    // Validar dias da semana se fornecidos
    let diasSemanaJson = null;
    if (dias_semana && Array.isArray(dias_semana) && dias_semana.length > 0) {
      const diasValidos = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
      const diasInvalidos = dias_semana.filter(dia => !diasValidos.includes(dia));
      if (diasInvalidos.length > 0) {
        return res.status(400).json({ 
          message: `Dias da semana inválidos: ${diasInvalidos.join(', ')}. Use: segunda, terca, quarta, quinta, sexta, sabado, domingo` 
        });
      }
      diasSemanaJson = JSON.stringify(dias_semana);
    }

    const [result] = await pool.query(
      `INSERT INTO endereco_avisos (
        endereco_id, titulo, mensagem, tipo, dias_semana,
        horario_inicio, horario_fim, prioridade
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, titulo, mensagem, tipo || 'info', diasSemanaJson,
        horario_inicio || null, horario_fim || null, prioridade || 1
      ]
    );

    res.status(201).json({
      message: 'Aviso criado com sucesso!',
      aviso: {
        id: result.insertId,
        titulo,
        tipo: tipo || 'info',
        dias_semana: dias_semana || null
      }
    });

  } catch (error) {
    next(error);
  }
};

// 9.1. Criar aviso geral (sem endereço específico)
const createAvisoGeral = async (req, res, next) => {
  const {
    titulo,
    mensagem,
    tipo,
    dias_semana,
    horario_inicio,
    horario_fim,
    prioridade
  } = req.body;

  const empresaId = req.empresa_id;
  const requestingUser = req.user;

  if (!titulo || !mensagem) {
    return res.status(400).json({ 
      message: 'Título e mensagem são obrigatórios.' 
    });
  }

  if (!['Proprietario', 'Gerente'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas Proprietário ou Gerente podem criar avisos.' 
    });
  }

  try {
    // Validar dias da semana se fornecidos
    let diasSemanaJson = null;
    if (dias_semana && Array.isArray(dias_semana) && dias_semana.length > 0) {
      const diasValidos = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
      const diasInvalidos = dias_semana.filter(dia => !diasValidos.includes(dia));
      if (diasInvalidos.length > 0) {
        return res.status(400).json({ 
          message: `Dias da semana inválidos: ${diasInvalidos.join(', ')}. Use: segunda, terca, quarta, quinta, sexta, sabado, domingo` 
        });
      }
      diasSemanaJson = JSON.stringify(dias_semana);
    }

    // Buscar o primeiro endereço ativo da empresa
    const [enderecoRows] = await pool.query(
      'SELECT id FROM empresa_enderecos WHERE empresa_id = ? AND ativo = TRUE ORDER BY data_criacao ASC LIMIT 1',
      [empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.status(404).json({ message: 'Nenhum endereço ativo encontrado para a empresa.' });
    }

    const enderecoId = enderecoRows[0].id;

    const [result] = await pool.query(
      `INSERT INTO endereco_avisos (
        endereco_id, titulo, mensagem, tipo, dias_semana,
        horario_inicio, horario_fim, prioridade
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        enderecoId, titulo, mensagem, tipo || 'info', diasSemanaJson,
        horario_inicio || null, horario_fim || null, prioridade || 1
      ]
    );

    res.status(201).json({
      message: 'Aviso criado com sucesso!',
      aviso: {
        id: result.insertId,
        titulo,
        tipo: tipo || 'info',
        dias_semana: dias_semana || null
      }
    });

  } catch (error) {
    next(error);
  }
};

// 10. Listar avisos do endereço
const getAvisosEndereco = async (req, res, next) => {
  const { id } = req.params;
  const empresaId = req.empresa_id;
  const requestingUser = req.user;
  const { ativo, tipo } = req.query;

  if (!['Proprietario', 'Gerente', 'Caixa', 'Funcionario'].includes(requestingUser.role)) {
    return res.status(403).json({ 
      message: 'Acesso negado. Você não tem permissão para visualizar avisos.' 
    });
  }

  try {
    // Verificar se o endereço pertence à empresa
    const [enderecoRows] = await pool.query(
      'SELECT id FROM empresa_enderecos WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.status(404).json({ message: 'Endereço não encontrado.' });
    }

    let query = `
      SELECT 
        id, titulo, mensagem, tipo, data_inicio, data_fim,
        horario_inicio, horario_fim, prioridade, ativo, data_criacao
      FROM endereco_avisos 
      WHERE endereco_id = ?
    `;
    
    const params = [id];

    if (ativo !== undefined) {
      query += ' AND ativo = ?';
      params.push(ativo === 'true' ? 1 : 0);
    }
    if (tipo) {
      query += ' AND tipo = ?';
      params.push(tipo);
    }

    query += ' ORDER BY prioridade DESC, data_criacao ASC';

    const [avisos] = await pool.query(query, params);
    res.status(200).json(avisos);
  } catch (error) {
    next(error);
  }
};

// 11. Obter avisos ativos do endereço do dia atual
const getAvisosDiaAtual = async (req, res, next) => {
  const empresaId = req.empresa_id;

  try {
    const [avisosRows] = await pool.query(
      `SELECT 
        ac.id,
        ac.titulo,
        ac.mensagem,
        ac.tipo,
        ac.prioridade,
        ac.dias_semana
       FROM avisos_cardapio ac
       WHERE ac.empresa_id = ?
       AND ac.ativo = TRUE
       AND (ac.dias_semana IS NULL OR JSON_CONTAINS(ac.dias_semana, JSON_QUOTE(CASE 
         WHEN DAYOFWEEK(CURDATE()) = 1 THEN 'domingo'
         WHEN DAYOFWEEK(CURDATE()) = 2 THEN 'segunda'
         WHEN DAYOFWEEK(CURDATE()) = 3 THEN 'terca'
         WHEN DAYOFWEEK(CURDATE()) = 4 THEN 'quarta'
         WHEN DAYOFWEEK(CURDATE()) = 5 THEN 'quinta'
         WHEN DAYOFWEEK(CURDATE()) = 6 THEN 'sexta'
         WHEN DAYOFWEEK(CURDATE()) = 7 THEN 'sabado'
       END)))
       ORDER BY ac.prioridade DESC, ac.data_criacao ASC`,
      [empresaId]
    );

    res.status(200).json(avisosRows);
  } catch (error) {
    next(error);
  }
};

// Atualizar aviso
const updateAviso = async (req, res, next) => {
  const { id: enderecoId, avisoId } = req.params;
  const { titulo, mensagem, tipo, dias_semana, prioridade, ativo } = req.body;
  const empresaId = req.empresa_id;

  if (!['Proprietario', 'Gerente'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Acesso negado. Apenas proprietários e gerentes podem editar avisos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar se o aviso existe e pertence ao endereço
    const [avisoRows] = await connection.query(
      `SELECT ea.id FROM endereco_avisos ea
       JOIN empresa_enderecos ee ON ea.endereco_id = ee.id
       WHERE ea.id = ? AND ea.endereco_id = ? AND ee.empresa_id = ?`,
      [avisoId, enderecoId, empresaId]
    );

    if (avisoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Aviso não encontrado ou não pertence a este endereço.' });
    }

    // Atualizar aviso
    await connection.query(
      `UPDATE endereco_avisos SET
        titulo = ?, mensagem = ?, tipo = ?, dias_semana = ?, 
        prioridade = ?, ativo = ?, data_atualizacao = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [titulo, mensagem, tipo, JSON.stringify(dias_semana), prioridade, ativo, avisoId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Aviso atualizado com sucesso'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Erro ao atualizar aviso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor ao atualizar aviso' 
    });
  } finally {
    connection.release();
  }
};

// Excluir aviso
const deleteAviso = async (req, res, next) => {
  const { id: enderecoId, avisoId } = req.params;
  const empresaId = req.empresa_id;

  if (!['Proprietario', 'Gerente'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Acesso negado. Apenas proprietários e gerentes podem excluir avisos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar se o aviso existe e pertence ao endereço
    const [avisoRows] = await connection.query(
      `SELECT ea.id FROM endereco_avisos ea
       JOIN empresa_enderecos ee ON ea.endereco_id = ee.id
       WHERE ea.id = ? AND ea.endereco_id = ? AND ee.empresa_id = ?`,
      [avisoId, enderecoId, empresaId]
    );

    if (avisoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Aviso não encontrado ou não pertence a este endereço.' });
    }

    // Excluir aviso
    await connection.query(
      'DELETE FROM endereco_avisos WHERE id = ?',
      [avisoId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Aviso excluído com sucesso'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Erro ao excluir aviso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor ao excluir aviso' 
    });
  } finally {
    connection.release();
  }
};

// Desativar/Ativar aviso
const desativarAviso = async (req, res, next) => {
  const { id: enderecoId, avisoId } = req.params;
  const { ativo } = req.body;
  const empresaId = req.empresa_id;

  if (!['Proprietario', 'Gerente'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Acesso negado. Apenas proprietários e gerentes podem desativar avisos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar se o aviso existe e pertence ao endereço
    const [avisoRows] = await connection.query(
      `SELECT ea.id FROM endereco_avisos ea
       JOIN empresa_enderecos ee ON ea.endereco_id = ee.id
       WHERE ea.id = ? AND ea.endereco_id = ? AND ee.empresa_id = ?`,
      [avisoId, enderecoId, empresaId]
    );

    if (avisoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Aviso não encontrado ou não pertence a este endereço.' });
    }

    // Atualizar status do aviso
    await connection.query(
      'UPDATE endereco_avisos SET ativo = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?',
      [ativo, avisoId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Aviso ${ativo ? 'ativado' : 'desativado'} com sucesso`
    });

  } catch (error) {
    await connection.rollback();
    console.error('Erro ao desativar aviso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor ao desativar aviso' 
    });
  } finally {
    connection.release();
  }
};

// Buscar endereço por dia específico
const getEnderecoPorDia = async (req, res, next) => {
  const { dia } = req.params;
  const empresaId = req.empresa_id;

  // Validar dia da semana
  const diasValidos = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  if (!diasValidos.includes(dia)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dia da semana inválido. Use: segunda, terca, quarta, quinta, sexta, sabado, domingo' 
    });
  }

  try {
    const [enderecoRows] = await pool.query(
      `SELECT 
        eds.id,
        eds.endereco_id,
        eds.dia_semana,
        eds.horario_inicio,
        eds.horario_fim,
        eds.observacoes,
        ee.nome AS endereco_nome,
        ee.endereco_completo,
        ee.cidade,
        ee.estado,
        ee.cep,
        ee.telefone,
        ee.email
       FROM endereco_dias_semana eds
       JOIN empresa_enderecos ee ON eds.endereco_id = ee.id
       WHERE eds.dia_semana = ?
       AND eds.ativo = TRUE
       AND ee.ativo = TRUE
       AND ee.empresa_id = ?`,
      [dia, empresaId]
    );

    if (enderecoRows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: `Nenhum endereço encontrado para ${dia}`
      });
    }

    res.json({
      success: true,
      data: enderecoRows[0],
      message: `Endereço encontrado para ${dia}`
    });

  } catch (error) {
    console.error('Erro ao buscar endereço por dia:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor ao buscar endereço' 
    });
  }
};

module.exports = {
  createEndereco,
  getAllEnderecos,
  getEnderecoById,
  updateEndereco,
  deleteEndereco,
  addDiaSemana,
  getDiasSemana,
  updateDiaSemana,
  deleteDiaSemana,
  getEnderecoDiaAtual,
  createAviso,
  createAvisoGeral,
  getAvisosEndereco,
  getAvisosDiaAtual,
  updateAviso,
  deleteAviso,
  desativarAviso,
  getEnderecoPorDia
};
