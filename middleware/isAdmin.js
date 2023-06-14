const { pool } = require("../db/db");

const isAdmin=(req,res,next)=>{
    const email=req.headers.email;
     
     const q='SELECT org_email_address from organisation where org_email_address=?'
     console.log(email)
    pool.query(q,[email],(err,result)=>{
         if(err){
            console.log(err)
            return res.status(300).send({"error":"cannot procesess req"})
        }
         else if(result.length===0){
            return res.status(301).send({"error":"please login again"})
         }
         else{
            next()
         }
    })
}


module.exports={
    isAdmin
}
