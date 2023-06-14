const bcrypt = require('bcrypt');
require("dotenv").config()
const encryptPassword = async (password) => {
  try {
     // Number of salt rounds for bcrypt hashing
    const hashedPassword = await bcrypt.hash(password, Number(process.env.saltround));
    console.log(hashedPassword)
    return hashedPassword;
  } catch (error) {
    console.log(error);
 
    throw new Error('Error encrypting password');
  }
};


module.exports={encryptPassword}