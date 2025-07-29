// Script para atualizar a tabela avisos_status
const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateAvisosStatusTable() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('Conectando ao banco de dados...');
    
    // Alterar o ENUM da coluna status
    console.log('Alterando estrutura da tabela avisos_status...');
    await pool.execute(`
      ALTER TABLE avisos_status 
      MODIFY COLUMN status ENUM('Não Lido', 'Lido', 'Visualizar Depois') NOT NULL DEFAULT 'Não Lido'
    `);
    
    console.log('✅ Tabela avisos_status atualizada com sucesso!');
    console.log('✅ Novo status "Visualizar Depois" adicionado ao ENUM');
    
    // Verificar a estrutura atualizada
    const [rows] = await pool.execute('DESCRIBE avisos_status');
    console.log('\n📋 Estrutura atual da tabela avisos_status:');
    console.table(rows);
    
  } catch (error) {
    console.error('❌ Erro ao atualizar tabela:', error.message);
  } finally {
    await pool.end();
  }
}

updateAvisosStatusTable(); 