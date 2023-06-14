const { pool } = require("../db/db");

const isAdmin=(req,res,next)=>{
    const email=req.headers.email;
     
     const q='SELECT email from organisation where email=?'
    pool.query(q,[email],(err,result)=>{
         if(err)return res.status(300).send({"error":"cannot procesess req"})
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
