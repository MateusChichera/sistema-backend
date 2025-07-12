const { pool } = require('../config/db');



//Função para guardar acesso do cardapio digital para relatorio de acesso
const saveCardapioDigitalAccess = async (req, res, next) => {
    const { session_id, dispositivo,ip_address} = req.body;
    const empresa_id = req.empresa_id; // Vem do middleware extractEmpresaId

    try {
        console.log(empresa_id, session_id,dispositivo,ip_address);
        const [result] = await pool.query('INSERT INTO acessos_menu (empresas_id, session_id,dispositivo,ip_address) VALUES (?, ?, ?, ?)', [empresa_id, session_id,dispositivo,ip_address]);
        res.status(200).json({ message: 'Acesso salvo com sucesso' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao salvar acesso' });
    }
}

module.exports = {
  saveCardapioDigitalAccess,
};


