const { pool } = require('../config/db');


const getRelatorioCaixa = async (req, res, next) => {
    const empresaId = req.empresa_id;
    const {
        data_abertura, // data específica no formato 'YYYY-MM-DD'
        status_caixa,
        funcionario_abertura_nome,
        forma_pagamento_pedido,
        tipo_pedido_delivery_ou_nao
    } = req.query;

    if(!['Proprietario','Gerente','Caixa'].includes(req.user.role)){
        return res.status(403).json({message:'Acesso negado'});
    }

    let query = `SELECT * FROM view_fechamento_caixa_completo WHERE empresas_id = ?`;
    const params = [empresaId];

    if (data_abertura) {
        query += ` AND DATE(data_abertura) = ?`;
        params.push(data_abertura);
    }
    if (status_caixa) {
        query += ` AND status_caixa = ?`;
        params.push(status_caixa);
    }
    if (funcionario_abertura_nome) {
        query += ` AND funcionario_abertura_nome = ?`;
        params.push(funcionario_abertura_nome);
    }
    if (forma_pagamento_pedido) {
        query += ` AND forma_pagamento_pedido = ?`;
        params.push(forma_pagamento_pedido);
    }
    if (tipo_pedido_delivery_ou_nao) {
        query += ` AND tipo_pedido_delivery_ou_nao = ?`;
        params.push(tipo_pedido_delivery_ou_nao);
    }

    try {
        const [rows] = await pool.query(query, params);
        return res.json(rows);
    } catch (error) {
        return next(error);
    }
};

const getRelatorioPedidos = async (req, res, next) => {
    const empresaId = req.empresa_id;
    const {
        tipo_entrega,
        status_pedido,
        data_inicio,
        data_fim
    } = req.query;

    if(!['Proprietario','Gerente','Caixa'].includes(req.user.role)){
        return res.status(403).json({message:'Acesso negado'});
    }

    let query = `SELECT * FROM relatorio_detalhado_pedidos WHERE empresa_id = ?`;
    const params = [empresaId];

    if (tipo_entrega) {
        // Se tem vírgula, divide em múltiplos valores
        if (tipo_entrega.includes(',')) {
            const tipos = tipo_entrega.split(',').map(t => t.trim()).filter(t => t);
            const placeholders = tipos.map(() => '?').join(',');
            query += ` AND tipo_entrega IN (${placeholders})`;
            params.push(...tipos);
        } else {
            query += ` AND tipo_entrega = ?`;
            params.push(tipo_entrega);
        }
    }
    if (status_pedido) {
        // Se tem vírgula, divide em múltiplos valores
        if (status_pedido.includes(',')) {
            const status = status_pedido.split(',').map(s => s.trim()).filter(s => s);
            const placeholders = status.map(() => '?').join(',');
            query += ` AND status_pedido IN (${placeholders})`;
            params.push(...status);
        } else {
            query += ` AND status_pedido = ?`;
            params.push(status_pedido);
        }
    }
    if (data_inicio) {
        query += ` AND DATE(data_pedido) >= ?`;
        params.push(data_inicio);
    }
    if (data_fim) {
        query += ` AND DATE(data_pedido) <= ?`;
        params.push(data_fim);
    }

    // Ordenar por data do pedido (mais recente primeiro)
    query += ` ORDER BY data_pedido DESC`;

    try {
        const [rows] = await pool.query(query, params);
        return res.json(rows);
    } catch (error) {
        return next(error);
    }
};

const getRelatorioEstoque = async (req, res, next) => {
    const empresaId = req.empresa_id;
    const {
        data_inicio,
        data_fim,
        resultado, // Positivo, Negativo ou Zerado
        curva // A, B, C ou combinações como A,C
    } = req.query;

    if(!['Proprietario','Gerente'].includes(req.user.role)){
        return res.status(403).json({message:'Acesso negado'});
    }

    try {
        // Preparar parâmetros para a stored procedure
        const dataInicio = data_inicio || null;
        const dataFim = data_fim || null;
        const resultadoParam = resultado || null;
        const curvaParam = curva || null;

        // Chamar a stored procedure
        const [rows] = await pool.query(
            'CALL sp_relatorio_gerencial_estoque_final(?, ?, ?, ?, ?)',
            [empresaId, dataInicio, dataFim, resultadoParam, curvaParam]
        );

        // A stored procedure pode retornar múltiplos result sets
        // Geralmente o primeiro result set contém os dados principais
        const dadosRelatorio = rows[0] || [];
        
        return res.json(dadosRelatorio);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    getRelatorioCaixa,
    getRelatorioPedidos,
    getRelatorioEstoque
};

