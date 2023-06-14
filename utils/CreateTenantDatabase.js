const mysql = require('mysql');
const { dbConfig, pool } = require('../db/db');

async function createTenantDatabase(databaseName) {


      const createDatabaseQuery = `CREATE DATABASE ${databaseName}`;

    pool.query(createDatabaseQuery, (error, results) => {
        pool.end(); // Close the connection to the master database

        if (error) {
          return res.status(500).send('Error creating the tenant database:', error);
          reject(error);
        } else {
            console.log("database created succesfully")
            return 
        }
      });
  
}

module.exports={createTenantDatabase}