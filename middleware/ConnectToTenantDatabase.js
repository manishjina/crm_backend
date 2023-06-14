const mysql = require('mysql');
const { dbConfig } = require('../db/db');

// Function to create a MySQL connection pool
function createPool(dbConfig) {
  return mysql.createPool(dbConfig);
}

// Middleware to connect to the specific database
function connectToTenantDatabase(req, res, next) {
  const tenant_uuid = req.headers['x-tenant-uuid']; // Assuming the tenant UUID is provided in the request headers

// Token decrypt
const tenaant_uuid=decodedtoken
  const userDbConfig = {
    ...dbConfig,
    database: `tenant_${tenant_uuid}`,
  };

  const pool = createPool(userDbConfig);

  pool.getConnection((error, connection) => {
    if (error) {
      console.error('Error getting connection to user database:', error);
      return res.status(500).send({ error: `Cannot process request: ${error}` });
    }

    // Add the 'connection' object to the request for future use
    req.dbConnection = connection;

    // Release the connection back to the pool after the middleware is done
    res.on('finish', () => {
      connection.release();
    });

    next();
  });
}

module.exports = connectToTenantDatabase;
