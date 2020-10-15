const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const _ = require('lodash');

const Admin = require('../models/admin.model')

const { OAuth2Client } = require('google-auth-library'); // google package
const fetch = require('node-fetch'); // for fetching facebook info

// sendgrid email server
const sgMail = require('@sendgrid/mail');
const { response } = require('express');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);



exports read = async (req, res) => {
    try{
        const adminList = await Admin.find();
        res.json(adminList);
    }catch(err){
        res.json({message: err});
    }
}