const { dbConfig, connection} = require("../db/db");
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

const { pool } = require('../db/db');
const { generateToken } = require("../utils/GenerateToken");

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

    // Check if contact already exists
    const checkContactQuery = 'SELECT * FROM contacts WHERE email = ?';
    const checkContactValues = [email];

    // Get a connection from the pool
    pool.getConnection((error, connection) => {
      if (error) {
        console.error("Error getting database connection:", error);
        return res.status(500).json({ error: "Internal server error" });
      }

      // Check if the contact exists
      connection.query(checkContactQuery, checkContactValues, (queryError, results) => {
        if (queryError) {
          console.error("Error checking contact existence:", queryError);
          connection.release();
          return res.status(500).json({ error: "Registration failed" });
        }

        if (results.length > 0) {
          // Contact already exists
          connection.release();
          return res.status(400).json({ error: "Contact already exists" });
        }

        // Insert registration data into the 'contacts' table
        const registrationQuery =
          "INSERT INTO contacts (`email`, `password`, `name`, `tenant_id`) VALUES (?, ?, ?, ?)";
        const registrationValues = [email, hashedPassword, name, tenant_id];

        connection.query(registrationQuery, registrationValues, (insertError, insertResult) => {
          if (insertError) {
            console.error("Error inserting registration data:", insertError);
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
        });
      });
    });
  } catch (error) {
    console.error("Error during contact registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const HandleLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const getUserQuery = 'SELECT * FROM contacts WHERE email = ?';
    const getUserValues = [email];

    // Get a connection from the pool
    pool.getConnection((error, connection) => {
      if (error) {
        console.error('Error getting database connection:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }

      connection.query(getUserQuery, getUserValues, async (queryError, results) => {
        if (queryError) {
          console.error('Error retrieving user data:', queryError);
          connection.release();
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
          connection.release();
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          connection.release();
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token =await generateToken(user.tenant_id);

        connection.release();
        res.status(200).json({ token });
      });
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {HandleContactRegister,HandleLogin};
