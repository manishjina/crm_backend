const { dbConfig, connection } = require("../db/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();
const mysql = require("mysql");
const { OAuth2Client } = require('google-auth-library');

// Create an OAuth2Client instance with your client ID

const client = new OAuth2Client("920633177734-9580n1m1ckgsmilqmd5j1qurkp2evuo7.apps.googleusercontent.com");
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
  let idToken="eyJhbGciOiJSUzI1NiIsImtpZCI6IjA1MTUwYTEzMjBiOTM5NWIwNTcxNjg3NzM3NjkyODUwOWJhYjQ0YWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiOTIwNjMzMTc3NzM0LTk1ODBuMW0xY2tnc21pbHFtZDVqMXF1cmtwMmV2dW83LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiOTIwNjMzMTc3NzM0LTk1ODBuMW0xY2tnc21pbHFtZDVqMXF1cmtwMmV2dW83LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTExOTAyMDkyMTg2NjcyNTAyNTU4IiwiaGQiOiJkZXZyaXNlci5jb20iLCJlbWFpbCI6InN1dmFtLnBhbmRhQGRldnJpc2VyLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoibDVlTEpQSi1pQjBPWDhZUHV3Y3ZfZyIsIm5hbWUiOiJTdXZhbSBQQU5EQSIsImdpdmVuX25hbWUiOiJTdXZhbSIsImZhbWlseV9uYW1lIjoiUEFOREEiLCJsb2NhbGUiOiJlbiIsImlhdCI6MTY4NzA4MzI4MiwiZXhwIjoxNjg3MDg2ODgyLCJqdGkiOiIzYzMxN2FiN2MwYzNjMjAyMjJlYjFjYTE2YTUxYjU0Yjk5M2Q2ZGIzIn0.ndWZswZgppiUN1WAbRppElIt_kYPe0BkTKr_BoIFmbm0FF_80z5UDnuV8--rOxt2hv1buWc3ZzOIAHm8EGoaSRINy11OPm3urDNayA2B-8K49lQJTpHjR2tUkIXdrNvahKoOJvYtq6txUc78rejVKmIfMpcCFGCwmIpRqQYo7GnQg2521VqeYpeCxivhsSVXuywiv815BnhfROhvvYLJAytq2Z3zTLHqhDKNZ9UiTmpcU0OxnU97HjOlr9NjbpZNs_DgOgs2ErEuvHMNqgkibIuyAAMnX1eLcrateK0f_7XOQoCSUHv489UG3AO3FikNfXCcEWLSEi9CASU1r8yHcQ"

  try {
    // Verify the ID 
    const ticket = await client.verifyIdToken({
      idToken,
      audience: "920633177734-9580n1m1ckgsmilqmd5j1qurkp2evuo7.apps.googleusercontent.com", // Verify that the token was issued for your client ID
    });

// here we are taking google unique id as password. 
    const {password}=req.body
    const { name, email, picture } = ticket.getPayload();
    console.log(name, email, picture,password);

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
          const hashedPassword=encryptPassword(password)
          const insertQuery =
            "INSERT INTO contacts (`email`, `password`, `name`, `tenant_id`, login_by) VALUES (?, ?, ?, ?, ?)";
        const insertValues = [email, hashedPassword, name, tenant_id, "google" ];
          connection.query(insertQuery, insertValues, async(insertError, insertResult) => {
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
      });
    });
  } catch (error) {
    // Error occurred during token verification
    console.error("Error verifying Google ID token:", error);
    res.status(400).json({ error: "Invalid ID token" });
  }
}



module.exports = { HandleContactRegister, HandleLogin, handleGoogleSignIn };


