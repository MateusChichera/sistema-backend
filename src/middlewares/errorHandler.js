const errorHandler = (err, req, res, next) => {
  console.error('Erro na API:', err.stack); // Loga o stack trace do erro

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor.';

  res.status(statusCode).json({
    status: 'error',
    message: message,
    // Em ambiente de desenvolvimento, você pode incluir o stack para depuração
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;