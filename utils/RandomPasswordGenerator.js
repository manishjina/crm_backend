const crypto = require('crypto');
const generateRandomPassword = (length = 8) => {
    const buffer = crypto.randomBytes(length);
    const password = buffer.toString('base64').slice(0, length);
    return password;
  };
module.exports={generateRandomPassword}
