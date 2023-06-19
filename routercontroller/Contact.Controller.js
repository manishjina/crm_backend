const { dbConfig, connection } = require("../db/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();
const mysql = require("mysql");
const { OAuth2Client } = require("google-auth-library");

// Create an OAuth2Client instance with your client ID
const clientId =
  "1033811474185-1jehdlst3s9b7qrphf016nlglqm8rjc6.apps.googleusercontent.com"; // Verify that the token was issued for your client ID
const client = new OAuth2Client(
  "1033811474185-1jehdlst3s9b7qrphf016nlglqm8rjc6.apps.googleusercontent.com"
);
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
    let { email, name, password } = req.body;

    name = name.trim();
    password = password.trim();
    email = email.trim();
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
          details: "Error getting database connection",
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
    password = password.trim();
    email = email.trim();
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
  const { tokenId } = req.body;
  let idToken = tokenId;
  try {
    // Verify the ID
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });

    // here we are taking google unique id as password.
    const { password } = req.body;
    const { name, email, picture } = ticket.getPayload();
    // let dd = ticket.getPayload();
    // console.log(name, email, dd, password);

    const googleUserId = ticket.getUserId();

    pool.getConnection((error, connection) => {
      // Check if the user exists in the contacts table based on the email address
      const query = "SELECT * FROM contacts WHERE email = ?";
      connection.query(query, [email], async (error, results) => {
        const user = results[0];
        if (error) {
          console.error("Error querying the database:", error);
          return res.status(500).json({ error: "Database error" });
        }

        if (results.length > 0) {
          // User already exists, generate session token or JWT

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
          // const hashedPassword = await encryptPassword(password);

          // console.log(hashedPassword)
          const tenant_id = generateTenantDatabaseName(name, email, res);
          // insert the data to the contacts table
          const hashedPassword = await encryptPassword(password);
          console.log(hashedPassword);

          const insertQuery =
            "INSERT INTO contacts (`email`, `password`, `name`, `tenant_id`, `login_by`, `image_url`) VALUES (?, ?, ?, ?, ?, ?)";
          const insertValues = [
            email,
            hashedPassword,
            name,
            tenant_id,
            "google",
            picture || "",
          ];
          connection.query(
            insertQuery,
            insertValues,
            async (insertError, insertResult) => {
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
                  const rolesValues = [contactId, "Admin"];

                  connection.query(
                    rolesQuery,
                    rolesValues,
                    (rolesInsertError, rolesInsertResult) => {
                      connection.release();

                      if (rolesInsertError) {
                        console.error(
                          "Error inserting roles data:",
                          rolesInsertError
                        );
                        return res.status(500).json({
                          success: false,
                          error: "Registration failed",
                          details: "Error inserting roles data",
                        });
                      }

                      // Generate session token or JWT
                      const sessionToken = generateToken(tenant_id);

                      // Send the session token as a response
                      res.json({
                        success: true,
                        message: "Registration successful",
                        data: {
                          userId: contactId,
                          username: name,
                          email: email,
                          token: sessionToken,
                        },
                      });
                    }
                  );
                }
              );
            }
          );
        }
      });
    });
  } catch (error) {
    console.error("Error verifying the Google ID token:", error);
    return res.status(500).json({ error: "Google sign-in error" });
  }
}

module.exports = { HandleContactRegister, HandleLogin, handleGoogleSignIn };
