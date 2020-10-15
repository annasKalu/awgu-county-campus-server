const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const _ = require('lodash');

const { OAuth2Client } = require('google-auth-library'); // google package
const fetch = require('node-fetch'); // for fetching facebook info

// sendgrid email server
const sgMail = require('@sendgrid/mail');
const { response } = require('express');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


// exports.signup = (req, res) => {
//     console.log('Reg body on signup', req.body);
//     const { name, email, password } = req.body

//     User.findOne({ email }).exec((err, user) => {
//         if (user) {
//             return res.status(400).json({
//                 error: 'Email already exist'
//             })
//         }
//     });

//     let newUser = new User({ name, email, password })
//     newUser.save((err, success) => {
//         if (err) {
//             console.log('Signup error')
//             return res.status(400).json({
//                 error: err
//             })
//         }
//         res.json({
//             user: newUser,
//             message: 'Sign up was successful! You can sign in now'
//         })
//     });
// }

exports.signup = (req, res) => {
    const { name, email, password } = req.body

    User.findOne({ email }).exec((err, user) => {
        if (user) {
            return res.status(400).json({
                error: 'Email already exist'
            })
        }

        const token = jwt.sign({ name, email, password }, process.env.JWT_ACCOUNT_ACTIVATION, { expiresIn: '20m' })
        const emailData = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: `Account activation link`,
            html: `
            <h2>Please, click on the following link to activate your account!</h2>
            <p> ${process.env.CLIENT_URL}/auth/activate/${token}</p>
            <hr />
            <p> This email may contain sensitive information. If you received it by mistake, please delete it immediately and contact the sender</p>
            <p>${process.env.CLIENT_URL}</p>
            `
        };
        sgMail
            .send(emailData)
            .then(sent => {
                console.log('Signup email sent', sent);
                return res.json({
                    message: `Email has been sent to ${email}. Follow the instruction to activate your account`
                });
            })
            .catch(err => {
                console.log('SIGNUP EMAIL SENT ERROR', err)
                return res.json({
                    message: err.message
                });
            });
    });
};

exports.accountActivation = (req, res) => {
    const { token } = req.body;

    if (token) {
        jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function (err, decoded) {
            if (err) {
                console.log('JWT VERIFY IN ACCOUNT ACTIVATION ERROR', err);
                return res.status(401).json({
                    error: 'Expired link. Signup again'
                });
            }

            const { name, email, password } = jwt.decode(token);

            const user = new User({ name, email, password });

            user.save((err, user) => {
                if (err) {
                    console.log('SAVE USER IN ACCOUNT ACTIVATION ERROR', err);
                    return res.status(401).json({
                        error: 'Error saving user in database. Try to signup again'
                    });
                }
                return res.json({
                    message: 'Signup was a success. Please signin.'
                });
            });
        });
    } else {
        return res.json({
            message: 'Something went wrong. Try again.'
        });
    }
};

exports.signin = (req, res) => {
    const { email, password } = req.body;
    // check if user exist
    User.findOne({ email }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User with that email does not exist. Please signup'
            });
        }
        // authenticate
        if (!user.authenticate(password)) {
            return res.status(400).json({
                error: "Email and password doesn't match"
            });
        }
        // generate a token and send to client
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const { _id, name, email, role } = user;

        return res.json({
            token,
            user: { _id, name, email, role }
        });
    });
};

exports.requireSignin = expressJwt({ // used to make sure that only signed in users can see their details and can make update to user infos
    secret: process.env.JWT_SECRET // req.user._id
});

exports.adminMiddleware = (req, res, next) => { // used to make sure that only admins can perform certain tasks
    User.findById({ _id: req.user._id }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: "User doesn't exist"
            });
        }

        if (user.role !== 'admin') {
            return res.status(400).json({
                error: 'Admin resource. Access denied.'
            });
        }

        req.profile = user;
        next();
    });
};


exports.forgotPassword = (req, res) => {
    const { email } = req.body;

    User.findOne({ email }, (err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User with that email is not found, please verify the email again'
            });
        }

        const token = jwt.sign({ _id: user._id, name: user.name }, process.env.JWT_RESET_PASSWORD, { expiresIn: '20m' });

        const emailData = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: `Password Reset link`,
            html: `
                <h1>Please use the following link to reset your password</h1>
                <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
                <hr />
                <p> This email may contain sensitive information. If you received it by mistake, please delete it immediately and contact the sender</p>
                <p>${process.env.CLIENT_URL}</p>
            `
        };
        return user.updateOne({ resetPasswordLink: token }, (err, success) => {
            if (err) {
                console.log('RESET PASSWORD LINK ERROR', err);
                return res.status(400).json({
                    error: 'Database connection error on user password forgot request'
                });
            } else {
                sgMail
                    .send(emailData)
                    .then(sent => {
                        // console.log('RESET PASSWORD  EMAIL SENT', sent)
                        return res.json({
                            message: `Email has been sent to ${email}. Follow the instruction to reset your password`
                        });
                    })
                    .catch(err => {
                        // console.log('RESET PASSWORD EMAIL SENT ERROR', err)
                        return res.json({
                            message: err.message
                        });
                    });

            }

        });

    });
};

exports.resetPassword = (req, res) => {
    const { resetPasswordLink, newPassword } = req.body;

    if (resetPasswordLink) {
        jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, function (err, decoded) {
            if (err) {
                return res.status(400).json({
                    error: 'Expired link. Try again'
                });
            }

            User.findOne({ resetPasswordLink }, (err, user) => {
                if (err || !user) {
                    return res.status(400).json({
                        error: 'Something went wrong. Try again later'
                    });
                }

                const updatedFields = {
                    password: newPassword,
                    resetPasswordLink: ''
                };

                user = _.extend(user, updatedFields);

                user.save((err, result) => {
                    if (err) {
                        return res.status(400).json({
                            error: 'Reset user password error'
                        });
                    }
                    res.json({
                        message: `Password successfully reset and updated. You can now sign in!`
                    });
                });
            });
        });
    }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
exports.googleLogin = (req, res) => {
    const { idToken } = req.body

    client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID }).then(response => {
        const { email_verified, name, email } = response.payload
        if (email_verified) {
            User.findOne({ email }).exec((err, user) => {
                if (user) {
                    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
                    const { _id, email, name, role } = user

                    return res.json({
                        token, user: { _id, email, name, role }
                    })
                } else {
                    let password = email + process.env.JWT_SECRET

                    user = new User({ name, email, password })
                    user.save((err, data) => {
                        if (err) {
                            console.log('Error on saving user by google', err);
                            return res.status(400).json({
                                error: 'User signup with google failed'
                            })
                        }

                        const token = jwt.sign({ _id: data._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
                        const { _id, email, name, role } = user

                        return res.json({
                            token, user: { _id, email, name, role }
                        })
                    })
                }
            });
        } else {
            return res.status(400).json({
                error: 'Google login failed, please verify and try again!'
            })
        }
    })
}


exports.facebookLogin = (req, res) => {
    console.log('FACEBOOK SIGNIN REQ BODY', req.body);
    const { userID, accessToken } = req.body;

    const url = `https://graph.facebook.com/v2.11/${userID}/?fields=id,name,email&access_token=${accessToken}`;

    return (
        fetch(url, {
            method: 'GET'
        })
            .then(response => response.json())
            // .then(response => console.log(response))
            .then(response => { // IF USER ALREADY EXISTS IN DATABASE, IT WILL BE PAIRED AND SIGNED IN
                const { email, name } = response;
                User.findOne({ email }).exec((err, user) => {
                    if (user) {
                        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
                        const { _id, email, name, role } = user;
                        return res.json({
                            token,
                            user: { _id, email, name, role }
                        });
                    } else { // IF USER DOESN'T EXIST THEN THE USER WILL BE CREATED AND SIGNED IN
                        let password = email + process.env.JWT_SECRET;
                        user = new User({ name, email, password });
                        user.save((err, data) => {
                            if (err) {
                                console.log('ERROR FACEBOOK SIGNIN ON USER SAVE', err);
                                return res.status(400).json({
                                    error: 'User signup  with facebook failed'
                                });
                            }
                            const token = jwt.sign({ _id: data._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
                            const { _id, email, name, role } = data;
                            return res.json({
                                token,
                                user: { _id, email, name, role }
                            });
                        });
                    }
                });
            })
            .catch(error => {
                res.json({
                    error: 'Facebook signin attempt failed. Please, verify and try agin later'
                });
            })
    );
};