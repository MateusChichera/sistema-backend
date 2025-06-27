const bcrypt = require('bcryptjs');

const password = "561"; // A senha que você quer criptografar
const saltRounds = 12; // Mesma quantidade de salt rounds usada no authUtils.js

bcrypt.hash(password, saltRounds)
  .then(hash => {
    console.log('Hash da senha "561":');
    console.log(hash);
  })
  .catch(err => {
    console.error('Erro ao gerar o hash:', err);
  });