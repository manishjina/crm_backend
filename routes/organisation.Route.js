
const express=require('express');
const { isAdmin } = require('../middleware/isAdmin');
const verifyToken = require('../middleware/VerifyToken');
const { handelOrganisationDetails } = require('../routercontroller/Organisation.controller');

const organisationRoute=express.Router();


organisationRoute.get('/orgdetail', verifyToken, isAdmin,handelOrganisationDetails)