const express = require('express');
const router = express.Router();

const { signup, accountActivation, signin, forgotPassword, resetPassword, googleLogin, facebookLogin } = require('../controllers/auth.controller');

// Importing Validators:
const { userSignupValidator, userSigninValidator, forgotPasswordValidator, resetPasswordValidator } = require('../validators/auth.validator');
const { runValidation } = require('../validators/index')


router.post('/signup', userSignupValidator, runValidation, signup);
router.post('/account-activation', userSignupValidator, accountActivation);
router.post('/signin', userSigninValidator, runValidation, signin);

// forgot and reset password routes
router.put('/forgot-password', forgotPasswordValidator, runValidation, forgotPassword);
router.put('/reset-password', resetPasswordValidator, runValidation, resetPassword);



// google and facebook login routes
router.post('/google-login', googleLogin);
router.post('/facebook-login', facebookLogin);


module.exports = router;