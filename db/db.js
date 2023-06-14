const mysql = require("mysql");
require("dotenv").config();



const dbConfig={
    host:'localhost',
    user:'root',
    password:'Suvam@7787',
    database:'universaldatahub',
    connectionLimit:3
  }
  
  
    const pool = mysql.createPool(dbConfig);
  // Function to release the connection pool
  const releaseConnectionPool = () => {
    pool.end((err) => {
      if (err) {
        console.log("Error while releasing the connection pool:", err);
      } else {
        console.log("Connection pool released");
      }
    });
  };
  
  // Function to get a connection from the pool
  const connection = () => {
    return new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
        if (err) {
          console.log("Error while connecting to the database:", err);
          reject(err);
        } else {
          console.log("Successfully connected to the database. Connection ID:", connection.threadId,connection.config.database);
        
          resolve(connection);
        }
      });
    });
  };
  
  
    module.exports={dbConfig,connection,pool,releaseConnectionPool}