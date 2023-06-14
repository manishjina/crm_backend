const express=require('express')
const HandleContactRegister = require('../routercontroller/Contact.Controller')
const checkUserExists = require('../middleware/CheckContactExits')
const ContactRoute=express.Router()


ContactRoute.post("/register",checkUserExists,HandleContactRegister)



module.exports={ContactRoute}