const { dbConfig, connection } = require("../db/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();
const mysql = require("mysql");
const { OAuth2Client } = require('google-auth-library');

// Create an OAuth2Client instance with your client ID

const client = new OAuth2Client("");
const cookieParser = require("cookie-parser");
const { encryptPassword } = require("../utils/PasswordEncrypt");
const {
  generateTenantDatabaseName,
} = require("../utils/DatabaseNameGenerator");
const { createTenantDatabase } = require("../utils/CreateTenantDatabase");

const { pool } = require("../db/db");
const { generateToken } = require("../utils/GenerateToken");
const HandleContactRegister = async (req, res) => {
  try {
    let  { email, name, password } = req.body;

    name=name.trim()
    password=password.trim()
    email=email.trim()
    if (
      !email ||
      !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ||
      !password ||
      password.length < 6 ||
      !name ||
      name.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
      });
    }

    // Generate database name
    const tenant_id = generateTenantDatabaseName(name, email, res);

    // Encrypt password
    const hashedPassword = await encryptPassword(password);

    // Check if contact already exists
    const checkContactQuery = "SELECT * FROM contacts WHERE email = ?";
    const checkContactValues = [email];

    // Get a connection from the pool
    pool.getConnection((error, connection) => {
      if (error) {
        console.error("Error getting database connection:", error);
        return res.status(500).json({
          success: false,
          error: "Internal server error",
          details:"Error getting database connection"
        });
      }

      // Check if the contact exists
      connection.query(
        checkContactQuery,
        checkContactValues,
        (queryError, results) => {
          if (queryError) {
            console.error("Error checking contact existence:", queryError);
            connection.release();
            return res.status(500).json({
              success: false,
              error: "Registration failed",
              details: "Error checking contact existence",
            });
          }

          if (results.length > 0) {
            // Contact already exists
            connection.release();
            return res.status(400).json({
              success: false,
              error: "Already exists",
              details: "Contact already exists",
            });
          }

          // Insert registration data into the 'contacts' table
          const registrationQuery =
            "INSERT INTO contacts (`email`, `password`, `name`, `tenant_id`) VALUES (?, ?, ?, ?)";
          const registrationValues = [email, hashedPassword, name, tenant_id];

          connection.query(
            registrationQuery,
            registrationValues,
            (insertError, insertResult) => {
              if (insertError) {
                console.error(
                  "Error inserting registration data:",
                  insertError
                );
                connection.release();
                return res.status(500).json({
                  success: false,
                  error: "Registration failed",
                  details: "Error inserting registration data",
                });
              }

              const contactId = insertResult.insertId; // Get the inserted contact's ID

              // Save data in the 'organisation' table
              const organisationQuery =
                "INSERT INTO organisation (`org_db_name`, `org_email_address`) VALUES (?, ?)";
              const organisationValues = [tenant_id, email];

              connection.query(
                organisationQuery,
                organisationValues,
                (orgInsertError, orgInsertResult) => {
                  if (orgInsertError) {
                    console.error(
                      "Error inserting organisation data:",
                      orgInsertError
                    );
                    connection.release();
                    return res.status(500).json({
                      success: false,
                      error: "Registration failed",
                      details: "Error inserting organisation data",
                    });
                  }

                  const orgId = orgInsertResult.insertId; // Get the inserted organisation's ID

                  // Save data in the 'roles' table
                  const rolesQuery =
                    "INSERT INTO roles (`contact_role_id`, `role_name`) VALUES (?, ?)";
                  const rolesValues = [contactId, "SAdmin"];

                  connection.query(
                    rolesQuery,
                    rolesValues,
                    (rolesInsertError, rolesInsertResult) => {
                      if (rolesInsertError) {
                        console.error(
                          "Error inserting roles data:",
                          rolesInsertError
                        );
                        connection.release();
                        return res.status(500).json({
                          success: false,
                          error: "Registration failed",
                          details: "Error inserting roles data",
                        });
                      }

                      // Create the tenant's database using the tenant_id
                      createTenantDatabase(tenant_id)
                        .then(() => {
                          connection.release();
                          res.status(200).json({
                            success: true,
                            message: "Registration successful",
                            data: {
                              userId: contactId,
                              email: email,
                            },
                          });
                        })
                        .catch((tenantError) => {
                          console.error(
                            "Error creating tenant database:",
                            tenantError
                          );
                          connection.release();
                          res.status(500).json({
                            success: false,
                            error: "Registration failed",
                            details: "Error creating tenant database",
                          });
                        });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  } catch (error) {
    console.error("Error during contact registration:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: "Error during contact registration",
    });
  }
};

const HandleLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    password=password.trim()
    email=email.trim()
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Invalid data",
        details: "Invalid request data",
      });
    }

    const getUserQuery = "SELECT * FROM contacts WHERE email = ?";
    const getUserValues = [email];

    // Get a connection from the pool
    pool.getConnection((error, connection) => {
      if (error) {
        console.error("Error getting database connection:", error);
        return res.status(500).json({
          success: false,
          error: "Internal server error",
          details: "Error getting database connection",
        });
      }

      connection.query(
        getUserQuery,
        getUserValues,
        async (queryError, results) => {
          if (queryError) {
            console.error("Error retrieving user data:", queryError);
            connection.release();
            return res.status(500).json({
              success: false,
              error: "Internal server error",
              details: "Error retrieving user data",
            });
          }

          if (results.length === 0) {
            connection.release();
            return res.status(401).json({
              success: false,
              error: "Invalid credentials",
            });
          }

          const user = results[0];
          const passwordMatch = await bcrypt.compare(password, user.password);

          if (!passwordMatch) {
            connection.release();
            return res.status(401).json({
              success: false,
              error: "Invalid credentials",
              details: "Invalid credentials",
            });
          }

          // Generate token
          const token = await generateToken(user.tenant_id);

          connection.release();
          res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
              userId: user.contact_id,
              username: user.name,
              email: email,
              token: token,
            },
          });
        }
      );
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Handler for handling Google Sign-In

async function handleGoogleSignIn(req, res) {
  const { idToken } = req.body;

  try {
    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: CLIENT_ID, // Verify that the token was issued for your client ID
    });

    const { name, email, picture } = ticket.getPayload();
    const googleUserId = ticket.getUserId();

    // Check if the user exists in the contacts table based on the email address
    const query = "SELECT * FROM contacts WHERE email = ?";
    connection.query(query, [email], async (error, results) => {
      if (error) {
        console.error("Error querying the database:", error);
        return res.status(500).json({ error: "Database error" });
      }

      if (results.length > 0) {
        // User already exists, generate session token or JWT
        const user = results[0];
        const sessionToken = generateToken(user.tenant_id);
        // Send the session token as a response
        res.json({
          success: true,
          message: "Login successful",
          data: {
            userId: user.contact_id,
            username: user.name,
            email: email,
            token: sessionToken,
          },
        });
      } else {
        // User doesn't exist, create a new user record
        const newUser = {
          google_user_id: googleUserId,
          name,
          email,
          image_url: picture,
        };

        // insert the data to the contacts table
        const insertQuery =
          "INSERT INTO contacts (`email`, `password`, `name`, `tenant_id`) VALUES (?, ?, ?, ?)";
        const insertValues = [email, null, name, user.tenant_id];
        connection.query(insertQuery, newUser, async (error, result) => {
          if (error) {
            console.error("Error inserting new user into the database:", error);
            return res.status(500).json({
              success: false,
              error: {
                code: 500,
                message: "Internal Server Error",
                details: "Error inserting new user into the database.",
              },
            });
          }

          // Assign the generated user ID to the new user object
          newUser.id = result.insertId;

          // Generate session token or JWT for the new user
          const user = result[0];
          const token = await generateToken(user.tenant_id);
          // Create database
          const tenant_id = generateTenantDatabaseName(name, email, res);
          createTenantDatabase(tenant_id)
            .then(() => {
              connection.release();
              res.status(200).jsona({
                success: true,
                message: "Registration successful",
                data: {
                  email: email,
                },
              });
            })
            .catch((tenantError) => {
              console.error(":", tenantError);
              connection.release();
              res.status(500).json({
                success: true,
                error: {
                  code: 500,
                  message: "Registration failed",
                  details: "Error creating tenant database",
                },
              });
            });
        });
      }
    });
  } catch (error) {
    // Error occurred during token verification
    console.error("Error verifying Google ID token:", error);
    res.status(400).json({ error: "Invalid ID token" });
  }
}

module.exports = { HandleContactRegister, HandleLogin, handleGoogleSignIn };
