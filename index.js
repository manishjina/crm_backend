const express=require('express')
const cors=require('cors');
const { connection } = require('./db/db');
const app=express()
app.use(express.json());
app.use(cors());

// Middleware for CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});


 app.listen(8090, async (err) => {
    if (err) {
      console.log("inside server fuinction")
      console.log(err);
    } else {
      try {
        await connection(); // Connect to the database
        console.log(process.env.PORT||8000);
      } catch (error) {
        console.log("Error while connecting to the database:", error);
        server.close();
      }
    }
  });