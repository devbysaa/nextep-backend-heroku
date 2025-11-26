/* ==============================
   AUTH ROUTES
   This file handles authentication - signing in/up users and verifying tokens
  ============================== */

/* ======== DEPENDENCIES ======= */

// Import express
const express = require('express')

// Create a new router (mini Express app just for /auth)
const router = express.Router()

// Used to verify password and generate access token
const Utils = require('../Utils')

// Import User model (blueprint for user data) to interact with MongoDB
const User = require('../models/User')

// Import the jsonwebtoken library
// This library is used to create (sign) and check (verify) JWT tokens for authentication
const jsonWebToken = require('jsonwebtoken')

// Load environment variables from the .env file into process.env
require('dotenv').config()

/* =======================================
   POST /auth/signin
   Lets a user login with email + password
  ======================================== */
router.post('/signin', async (req, res) => {
    try {
        let {email, password } = req.body

        // === VALIDATE INPUT ===
        // Make sure the request body contains both email and password.
        if (!req.body.email || !req.body.password) {
            return res.status(400).json({
                message: 'Email and password are required',
            })
        }

        // === FIND USER IN DATABASE ===
        // Try to find a user document by their email
        const user = await User.findOne({email})

        // If no user is found, stop and log error
        if (!user) {
            console.log('400 - This account does not exist')
            return res.status(400).json({
                message: 'This account does not exist',
            })
        }

        // === VERIFY PASSWORD ===
        // Utils.verifyPassword() will hash the input and compare with hashed password in MongoDB
        const validPassword = Utils.verifyPassword(password, user.password)

        // If password check fails, reject login
        if (!validPassword) {
            console.log('400 - Email or password is incorrect')
            return res.status(400).json({
                message: 'Email or password is incorrect',
            })
        }

        // === CREATE A USER OBJECT ===
        // This is the data stored inside the JWT token (and sent back to frontend)
        const userObject = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            bio: user.bio || '',
            accessLevel: user.accessLevel,
            newUser: user.newUser,
            avatar: user.avatar,
        }

        // === GENERATE JWT TOKEN ===
        // This uses Utils.generateAccessToken() which signs a token with the SECRET_KEY
        const token = Utils.generateAccessToken(userObject)

        // === SUCCESS RESPONSE ===
        // Send both the token and the user info back to frontend
        console.log('200 - Successfully logged in')
        res.status(200).json({
            token: token,
            user: userObject,
        })

        // === CATCH ERRORS ===
    } catch (err) {
        console.error(err)
        res.status(500).json({
            message: 'Error signing in',
            error: err.message,
        })
    }
})

/* ==============================================
   GET /auth/check-email/:email
   Check if a user with this email already exists
  =============================================== */
router.get('/check-email/:email', async (req, res) => {
    try {
        // === GET EMAIL FROM URL ===
        const email = req.params.email;

        // If no email provided
        if (!email) {
            return res.status(400).json({
                message: 'Email parameter is required in the URL'
            });
        }

        // === SEARCH EMAIL ===
        // Search for an existing user with that email in MongoDB
        const existing = await User.findOne({ email });

        // If a user already exists → return 409 Conflict
        if (existing) {
            console.log('Email already in use')
            return res.status(409).json({
                message: 'Email is already in use'
            });
        }

        // === SUCCESS RESPONSE ===
        // If no match found → return 200 OK
        res.status(200).json();

        // === CATCH ERRORS ===
    } catch (err) {
        console.error('Error checking email:', err);
        res.status(500).json({
            message: 'Error checking email',
            error: err.message
        });
    }
});

/* ==============================
   POST /auth/change-password
   Change password for the currently authenticated user
  ============================== */
router.post('/change-password', async (req, res) => {
    try {

        // Read Authorization header (header names are always lowercased in Node)
        const authHeader = req.headers['authorization']

        // No Authorization header present → 401
        if (!authHeader) {
            return res.status(401).json({
                message: 'Authorization header missing',
            })
        }


        // Reject request when header is missing
        if (!authHeader) {
            return res.status(401).json({
                message: 'Authorization header missing',
            })
        }

        // Split header on space and take token part
        const token = authHeader.split(' ')[1]

        // Reject request when token is missing
        if (!token) {
            return res.status(401).json({
                message: 'Token missing',
            })
        }

        // Extract old and new password from request body
        const { oldPassword, newPassword } = req.body

        // Validate body fields
        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                message: 'Old password and new password are required',
            })
        }

        // Verify token and decode payload to access user id
        const decoded = await new Promise((resolve, reject) => {
            jsonWebToken.verify(token, process.env.SECRET_KEY, (err, decodedData) => {
                if (err) {
                    return reject(err)
                }
                resolve(decodedData)
            })
        })

        // Extract user id from decoded token payload
        const payloadUser = decoded.user || decoded
        const userId = payloadUser.id || payloadUser._id

        // Reject request when token payload does not contain id
        if (!userId) {
            return res.status(401).json({
                message: 'Invalid token payload',
            })
        }

        // Look up user by id in database
        const user = await User.findById(userId)

        // Return 404 when no matching user exists
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            })
        }

        // Verify existing password using helper from Utils
        const validPassword = Utils.verifyPassword(oldPassword, user.password)

        // Reject when old password does not match stored hash
        if (!validPassword) {
            return res.status(400).json({
                message: 'Old password is incorrect',
            })
        }

        // Assign new password as plain text
        // Pre-save middleware on User model hashes this value before storing
        user.password = newPassword

        // Save updated user document (triggers pre-save hook for hashing)
        await user.save()

        // Respond with success status
        return res.status(200).json({
            message: 'Password changed successfully',
        })

    } catch (err) {
        console.error('Error changing password:', err)

        // Fallback error for unexpected issues
        return res.status(500).json({
            message: 'Error changing password',
            error: err.message,
        })
    }
})

/* ==============================
   GET /auth/validate
   Check if JWT token is still valid (not expired/tampered)
  ============================== */
router.get('/validate', async (req, res) => {
    try {
        // === EXTRACT TOKEN FROM HEADER ===
        // The frontend sends: Authorization: Bearer <token>
        const authHeader = req.headers['authorization']

        // If the header is missing, deny the request
        if (!authHeader) {
            return res.status(401).json({ message: 'Authorization header missing' })
        }

        // Split into ["Bearer", "<token>"] and take the token part
        const token = authHeader.split(' ')[1]

        // If no token found after "Bearer", deny
        if (!token) {
            return res.status(401).json({ message: 'Token missing' })
        }

        // === VERIFY TOKEN ===
        // This checks if the token was signed with SECRET_KEY and is still valid
        const decoded = await new Promise((resolve, reject) => {
            jsonWebToken.verify(token, process.env.SECRET_KEY, (err, decodedData) => {
                if (err) {
                    reject(err)
                }
                else resolve(decodedData)
            })
        })

        // === SUCCESS RESPONSE ===
        console.log('Token is valid, sending decoded data...')
        res.status(200).json(decoded)

        // === CATCH ERRORS ===
    } catch (err) {
        console.error('Error validating token:', err)

        // If verification failed (token expired, invalid, etc.), respond 403 (Forbidden)
        res.status(403).json({
            message: 'Invalid or expired token',
            error: err.message,
        })
    }
})

// Export this router so server.js can use it
module.exports = router