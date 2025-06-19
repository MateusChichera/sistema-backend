// backend/src/services/emailService.js
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVICE_HOST,
  port: parseInt(process.env.EMAIL_SERVICE_PORT), // Garante que a porta é um número
  secure: process.env.EMAIL_SERVICE_SECURE === 'true', // Converte para booleano
  auth: {
    user: process.env.EMAIL_AUTH_USER,
    pass: process.env.EMAIL_AUTH_PASS,
  },
  tls: {
    // Apenas para desenvolvimento (ignora certificado autoassinado)
    // REMOVER EM PRODUÇÃO OU CONFIGURAR CORRETAMENTE OS CERTIFICADOS
    rejectUnauthorized: false
  }
});

const sendOrderConfirmationEmail = async (toEmail, orderDetails, companyInfo) => {
  if (!process.env.EMAIL_AUTH_USER || !process.env.EMAIL_AUTH_PASS) {
    console.warn('Configurações de e-mail incompletas no .env. Envio de e-mail desativado.');
    return;
  }

  const companyName = companyInfo.nome_fantasia || 'Seu Restaurante';
  const companyEmail = companyInfo.email_contato || process.env.EMAIL_AUTH_USER;
  const companyPhone = companyInfo.telefone_contato || '';

  const mailOptions = {
    from: `"${companyName}" <${process.env.EMAIL_AUTH_USER}>`, // Remetente
    to: toEmail, // Destinatário
    subject: `Confirmação de Pedido #${orderDetails.numero_pedido} - ${companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #FF5733;">Confirmação de Pedido #${orderDetails.numero_pedido}</h2>
        <p>Olá ${orderDetails.cliente_nome || 'Cliente'},</p>
        <p>Seu pedido em <strong>${companyName}</strong> foi recebido e está sendo processado!</p>
        
        <h3 style="color: #FF5733;">Detalhes do Pedido:</h3>
        <p><strong>Número do Pedido:</strong> ${orderDetails.numero_pedido}</p>
        <p><strong>Tipo de Entrega:</strong> ${orderDetails.tipo_entrega}</p>
        ${orderDetails.id_mesa ? `<p><strong>Mesa:</strong> ${orderDetails.id_mesa}</p>` : ''}
        ${orderDetails.observacoes ? `<p><strong>Observações:</strong> ${orderDetails.observacoes}</p>` : ''}
        
        <h3 style="color: #FF5733;">Itens do Pedido:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Produto</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Qtd</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Preço Unit.</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${orderDetails.itens.map(item => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.nome_produto} ${item.observacoes ? `(${item.observacoes})` : ''}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.quantidade}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">R$ ${parseFloat(item.preco_unitario).toFixed(2).replace('.', ',')}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">R$ ${parseFloat(item.quantidade * item.preco_unitario).toFixed(2).replace('.', ',')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Valor Total:</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ${parseFloat(orderDetails.valor_total).toFixed(2).replace('.', ',')}</td>
            </tr>
          </tfoot>
        </table>
        
        <p>${companyInfo.mensagem_confirmacao_pedido || 'Aguarde a entrega ou retirada do seu pedido. Agradecemos a preferência!'}</p>
        
        <p>Atenciosamente,<br><strong>${companyName}</strong><br>
        Email: ${companyEmail}<br>
        Telefone: ${companyPhone}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email de confirmação enviado para: ${toEmail} - Pedido #${orderDetails.numero_pedido}`);
  } catch (error) {
    console.error(`Erro ao enviar email de confirmação para ${toEmail} (Pedido #${orderDetails.numero_pedido}):`, error);
  }
};

module.exports = {
  sendOrderConfirmationEmail
};