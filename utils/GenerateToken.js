const jwt = require("jsonwebtoken");
const generateToken = (payload) => {
    return jwt.sign(payload, process.env.secret_key);
  };

  module.exports={generateToken}