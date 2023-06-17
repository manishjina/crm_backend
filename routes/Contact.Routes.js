const express=require('express')
const {HandleContactRegister,HandleLogin, handleGoogleSignIn} = require('../routercontroller/Contact.Controller')
const checkUserExists = require('../middleware/CheckContactExits')
const ContactRoute=express.Router()


ContactRoute.post("/register",checkUserExists,HandleContactRegister)
ContactRoute.post("/login",HandleLogin)
ContactRoute.post("/googlelogin",handleGoogleSignIn)


module.exports={ContactRoute}