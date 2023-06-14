const { dbConfig, connection, pool } = require("../db/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();
const mysql = require("mysql");

const cookieParser = require("cookie-parser");
const { encryptPassword } = require("../utils/PasswordEncrypt");
const {
  generateTenantDatabaseName,
} = require("../utils/DatabaseNameGenerator");
const { createTenantDatabase } = require("../utils/CreateTenantDatabase");

const HandleContactRegister = async (req, res) => {
  try {
    const { email, name, password } = req.body;

    if (
      !email ||
      !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ||
      !password ||
      password.length < 6 ||
      !name ||
      name.trim().length === 0
    ) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Generate database name
    const tenant_id = generateTenantDatabaseName(name, email, res);

    // Encrypt password
    const hashedPassword = await encryptPassword(password);

    const registrationQuery =
      "INSERT INTO contacts (`email`, `password`, `name`, `tenant_id`) VALUES (?, ?, ?, ?)";
    const registrationValues = [email, hashedPassword, name, tenant_id];

    // Get a connection from the pool
    pool.getConnection((error, connection) => {
      if (error) {
        console.error("Error getting database connection:", error);
        return res.status(500).json({ error: "Internal server error" });
      }

      // Insert registration data into the 'contacts' table
      connection.query(
        registrationQuery,
        registrationValues,
        (queryError, results) => {
          if (queryError) {
            console.error("Error inserting registration data:", queryError);
            connection.release();
            return res.status(500).json({ error: "Registration failed" });
          }

          // Create the tenant's database using the tenant_id
          createTenantDatabase(tenant_id)
            .then(() => {
              connection.release();
              res.status(200).json({ message: "Registration successful" });
            })
            .catch((tenantError) => {
              console.error("Error creating tenant database:", tenantError);
              connection.release();
              res.status(500).json({ error: "Registration failed" });
            });
        }
      );
    });
  } catch (error) {
    console.error("Error during contact registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Function to create the tenant's database

module.exports = HandleContactRegister;
