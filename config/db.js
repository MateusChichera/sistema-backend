const mysql = require('mysql2/promise'); // Usando a versão promise-based
const dotenv = require('dotenv');

dotenv.config(); // Carrega as variáveis de ambiente do arquivo .env

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306, // Porta padrão do MySQL
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Conexão com o banco de dados MySQL estabelecida com sucesso!');
    connection.release(); // Libera a conexão
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados MySQL:', error.message);
    process.exit(1); // Encerra o processo se a conexão falhar
  }
}

module.exports = { pool, testConnection };