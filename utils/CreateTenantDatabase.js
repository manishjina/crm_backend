const mysql = require("mysql");
const { dbConfig, pool } = require("../db/db");

async function createTenantDatabase(databaseName) {
  const createDatabaseQuery = `CREATE DATABASE tenant_${databaseName}`;

  pool.query(createDatabaseQuery, (error, results) => {
    // Close the connection to the master database

    if (error) {
      return res.status(500).send("Error creating the tenant database:", error);
      reject(error);
    } else {
      console.log("database created succesfully");
      return;
    }
  });
}

module.exports = { createTenantDatabase };
