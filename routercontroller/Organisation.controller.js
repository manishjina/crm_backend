const { pool } = require("../db/db");
const verifyToken = require("../middleware/VerifyToken");

const handelOrganisationDetails = (  req, res) => {
  const dbname=req.tennant_id;

   

  try {
    const q =
      "SELECT * org_db_name ,org_name,no_of_emp,anual_turnover,db_location from organisation where org_db_name=? ";

      pool.query(q,[dbname],(err,result)=>{
        if(err)return res.status(300).send({"error":"cannot process req",err})
        else{
            res.status(200).send(result)
        }
      })

  } catch (error) {
    console.log(error);
    return res.status(300).send({ error: "cannot process res", error });
  }
};

module.exports={handelOrganisationDetails}
