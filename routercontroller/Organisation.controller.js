const { pool } = require("../db/db");
const verifyToken = require("../middleware/VerifyToken");

const handelOrganisationDetails = (  req, res) => {
  const dbname=`${req.body.tenant_id}`;

   console.log(req.body)

  try {
    const q =
      "SELECT org_db_name ,org_name,no_of_emp,annual_turnover,db_location from organisation where org_db_name=? ";

      pool.query(q,[dbname],(err,result)=>{
        if(err)return res.status(300).send({"error":"caefewmofmeot process req",err})
        else{
            res.status(200).send(result)
        }
      })

  } catch (error) {
    console.log(error);
    return res.status(300).send({ error: "camfkmfot process res", error });
  }
};

module.exports={handelOrganisationDetails}
