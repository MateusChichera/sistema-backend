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

const getRelatorioContasPrazo = async (req, res, next) => {
    const empresaId = req.empresa_id;
    const {
        data_inicio,
        data_fim,
        tipo_filtro, // 'emissao' ou 'vencimento'
        status_titulo,
        cliente_id,
        funcionario_id
    } = req.query;

    if (!['Proprietario', 'Gerente', 'Caixa'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Acesso negado' });
    }

    try {
        // Determinar o campo de data baseado no tipo_filtro
        let campoData = 't.data_emissao';
        if (tipo_filtro === 'vencimento') {
            campoData = 't.data_vencimento';
        }

        let query = `
            SELECT 
                t.id AS titulo_id,
                t.numero_titulo,
                t.descricao AS titulo_descricao,
                t.valor_total,
                t.valor_pago,
                t.valor_restante,
                t.data_emissao,
                t.data_vencimento,
                t.data_pagamento,
                t.status,
                t.juros_aplicado,
                c.id AS cliente_id,
                c.nome AS cliente_nome,
                c.telefone AS cliente_telefone,
                c.email AS cliente_email,
                f.nome AS funcionario_nome,
                e.razao_social AS empresa_nome,
                e.juros_titulos AS percentual_juros_empresa,
                DATEDIFF(CURDATE(), t.data_vencimento) AS dias_vencimento,
                CASE 
                    WHEN t.status = 'Pago' THEN 'Pago'
                    WHEN t.data_vencimento < CURDATE() AND t.status = 'Pendente' THEN 'Vencido'
                    WHEN t.data_vencimento = CURDATE() AND t.status = 'Pendente' THEN 'Vence hoje'
                    WHEN t.status = 'Pendente' THEN 'Em dia'
                    ELSE t.status
                END AS situacao_titulo,
                CASE 
                    WHEN t.status = 'Pago' THEN 'Sim'
                    ELSE 'Não'
                END AS recebido,
                -- Calcular juros se vencido
                CASE 
                    WHEN t.data_vencimento < CURDATE() AND t.status = 'Pendente' AND e.juros_titulos > 0 THEN
                        ROUND((t.valor_restante * e.juros_titulos / 100) * DATEDIFF(CURDATE(), t.data_vencimento) / 30, 2)
                    ELSE 0
                END AS juros_calculado,
                -- Valor total com juros
                CASE 
                    WHEN t.data_vencimento < CURDATE() AND t.status = 'Pendente' AND e.juros_titulos > 0 THEN
                        t.valor_restante + ROUND((t.valor_restante * e.juros_titulos / 100) * DATEDIFF(CURDATE(), t.data_vencimento) / 30, 2)
                    ELSE t.valor_restante
                END AS valor_total_com_juros
            FROM titulos t
            LEFT JOIN clientes_contas_prazo c ON t.cliente_contas_prazo_id = c.id
            LEFT JOIN funcionarios f ON t.funcionario_id = f.id
            LEFT JOIN empresas e ON t.empresa_id = e.id
            WHERE t.empresa_id = ?
        `;

        const params = [empresaId];

        // Aplicar filtros
        if (data_inicio) {
            query += ` AND DATE(${campoData}) >= ?`;
            params.push(data_inicio);
        }
        if (data_fim) {
            query += ` AND DATE(${campoData}) <= ?`;
            params.push(data_fim);
        }
        if (status_titulo) {
            query += ` AND t.status = ?`;
            params.push(status_titulo);
        }
        if (cliente_id) {
            query += ` AND t.cliente_contas_prazo_id = ?`;
            params.push(cliente_id);
        }
        if (funcionario_id) {
            query += ` AND t.funcionario_id = ?`;
            params.push(funcionario_id);
        }

        query += ` ORDER BY ${campoData} DESC`;

        const [rows] = await pool.query(query, params);

        // Calcular estatísticas do relatório
        const estatisticas = {
            total_titulos: rows.length,
            titulos_pagos: rows.filter(r => r.status === 'Pago').length,
            titulos_pendentes: rows.filter(r => r.status === 'Pendente').length,
            titulos_vencidos: rows.filter(r => r.situacao_titulo === 'Vencido').length,
            valor_total_emprestado: rows.reduce((sum, r) => sum + parseFloat(r.valor_total || 0), 0),
            valor_total_pago: rows.reduce((sum, r) => sum + parseFloat(r.valor_pago || 0), 0),
            valor_total_restante: rows.reduce((sum, r) => sum + parseFloat(r.valor_restante || 0), 0),
            valor_total_juros: rows.reduce((sum, r) => sum + parseFloat(r.juros_calculado || 0), 0)
        };

        return res.json({
            success: true,
            data: rows,
            estatisticas: estatisticas,
            filtros_aplicados: {
                data_inicio,
                data_fim,
                tipo_filtro,
                status_titulo,
                cliente_id,
                funcionario_id
            },
            message: 'Relatório de contas a prazo gerado com sucesso!'
        });

    } catch (error) {
        console.error('Erro ao gerar relatório de contas a prazo:', error);
        return next(error);
    }
};

module.exports = {
    getRelatorioCaixa,
    getRelatorioPedidos,
    getRelatorioEstoque,
    getRelatorioContasPrazo
};

