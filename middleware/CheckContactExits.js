const mysql = require('mysql');
const { pool } = require('../db/db');

const checkUserExists = (req, res, next) => {
  const { email } = req.body;

  // Get a connection from the pool
  pool.getConnection((error, connection) => {
    if (error) {
      console.error('Error getting database connection:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const checkUserQuery = 'SELECT * FROM contacts WHERE email = ?';
    const checkUserValues = [email];

    // Execute the query to check if the user exists
    connection.query(checkUserQuery, checkUserValues, (queryError, results) => {
      if (queryError) {
        console.error('Error checking user existence:', queryError);
        connection.release();
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (results.length > 0) {
        // User already exists
        connection.release();
        return res.status(400).json({ error: 'Contacts already exists plese login' });
      }

      // User does not exist, proceed to the next middleware or route handler
      connection.release();
      next();
    });
  });
};

module.exports = checkUserExists;
