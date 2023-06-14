
const express=require('express');
const { isAdmin } = require('../middleware/isAdmin');
const verifyToken = require('../middleware/VerifyToken');
const { handelOrganisationDetails } = require('../routercontroller/Organisation.controller');

const OrganisationRoute=express.Router();


OrganisationRoute.get('/orgdetail', verifyToken, isAdmin,handelOrganisationDetails)


module.exports={OrganisationRoute}