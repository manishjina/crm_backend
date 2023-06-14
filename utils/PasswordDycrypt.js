const bcrypt = require('bcrypt');

const decryptPassword = async (password, hashedPassword) => {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    console.log(error);
    throw new Error('Error decrypting password');
  }
};

module.exports={decryptPassword}