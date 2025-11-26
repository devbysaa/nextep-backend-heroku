/* ==============================
   USER ROUTES
   This file defines all the HTTP endpoints for working with users
  ============================== */

/* ======== DEPENDENCIES ======= */

const express = require('express')

// Create a new router (mini Express app just for /user)
const router = express.Router()

// Import User model (blueprint for user data) to interact with MongoDB
const User = require('../models/User')

// Below dependencies are for handling avatar image files
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const sharp = require('sharp')
const Utils = require('../Utils')

// multer will temporarily store uploaded avatar images in uploads/
const upload = multer({dest: 'uploads/'})

/* ==============================
   GET /user
   Get all users from the database
  ============================== */
router.get('/', async (req, res) => {
    try {
        // === FETCH USERS ===
        const users = await User.find()

        res.status(200).json(users)
    } catch (err) {
        console.error('Error finding users:', err)
        res.status(500).json({
            message: 'Error finding users',
            error: err.message,
        })
    }
})

/* ===============================================
   GET /user/email/:email
   Retrieve a single user from MongoDB by their email
  ================================================= */
router.get('/email/:email', async (req, res) => {
    try {
        // Find a user whose email matches the route parameter
        const user = await User.findOne({email: req.params.email})

        // If no user is found, return 404
        if (!user) {
            return res.status(404).json({
                message: 'User not found for that email address',
            })
        }

        // Return the full user document
        res.status(200).json(user)
    } catch (err) {
        console.error('Error finding user by email:', err)

        res.status(500).json({
            message: 'Error finding user by email',
            error: err.message,
        })
    }
})

/* ===============================================
   GET /user/:id
   Retrieve a single user from MongoDB by their ID
  ================================================= */
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)

        if (!user) {
            return res.status(400).json({
                message: 'User does not exist',
            })
        }
        res.json(user)
    } catch (err) {
        console.error('Error finding user:', err)
        res.status(500).json({
            message: 'Error finding user',
            error: err.message,
        })
    }
})

/* ====================================
   POST /user
   Create a new user and save to MongoDB
  ==================================== */
router.post('/', async (req, res) => {
    try {
        const {firstName, lastName, email, password, accessLevel, bio} = req.body

        // === VALIDATE INPUT ===
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                message: 'Missing required fields (firstName, lastName, email, password)',
            })
        }

        // === CHECK FOR EXISTING USER ===
        const existingUser = await User.findOne({email})
        if (existingUser) {
            return res.status(409).json({
                message: 'Email is already in use',
            })
        }

        // === CREATE USER DOCUMENT ===
        const newUserDoc = new User({
            firstName,
            lastName,
            email,
            password,
            bio: bio || '',
            accessLevel: accessLevel || 1, // Default regular user
            avatar: '',                    // Empty avatar initially
            newUser: true,                 // Used later for guide screen
        })

        // === SAVE USER TO DATABASE ===
        const savedUser = await newUserDoc.save()

        // === CREATE JWT TOKEN PAYLOAD ===
        const userObject = {
            id: savedUser.id,
            firstName: savedUser.firstName,
            lastName: savedUser.lastName,
            email: savedUser.email,
            bio: savedUser.bio || '',
            accessLevel: savedUser.accessLevel,
            avatar: savedUser.avatar,
            newUser: savedUser.newUser,
        }

        const token = Utils.generateAccessToken(userObject)

        console.log('200 - User created successfully')
        res.status(201).json({
            message: 'User created successfully',
            token: token,
            user: userObject,
        })
    } catch (err) {
        console.error('Error during signup:', err)
        res.status(500).json({
            message: 'Error during signup',
            error: err.message,
        })
    }
})

/* ======================================
   DELETE /user/:id
   Delete a user from MongoDB by their ID
  ====================================== */
router.delete('/:id', async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({
                message: 'User ID is missing',
            })
        }

        const deletedUser = await User.findOneAndDelete({_id: req.params.id})

        if (!deletedUser) {
            return res.status(404).json({
                message: 'User not found',
            })
        }

        res.json({
            message: 'User deleted successfully',
        })
    } catch (err) {
        console.error('Error deleting user:', err)
        res.status(500).json({
            message: 'Error deleting user',
            error: err.message,
        })
    }
})

/* =============================================
   PUT /user/:id
   Update an existing user in MongoDB by their ID
  ============================================== */
router.put('/:id', async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({
                message: 'User content is empty',
            })
        }

        // Build updates object field-by-field so nothing is accidentally
        // overwritten with undefined or an empty string.
        const updates = {}

        if (req.body.firstName !== undefined) {
            updates.firstName = req.body.firstName
        }

        if (req.body.lastName !== undefined) {
            updates.lastName = req.body.lastName
        }

        if (req.body.email !== undefined) {
            updates.email = req.body.email
        }

        if (req.body.bio !== undefined) {
            updates.bio = req.body.bio
        }

        if (req.body.accessLevel !== undefined) {
            updates.accessLevel = req.body.accessLevel
        }

        if (req.body.newUser !== undefined) {
            updates.newUser = req.body.newUser
        }

        // Only update password if a non-empty value was provided
        // (e.g. admin typed a new password in the form)
        if (req.body.password && req.body.password.trim() !== '') {
            updates.password = req.body.password
        }

        const user = await User.findByIdAndUpdate(req.params.id, updates, {
            new: true,
        })

        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            })
        }

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

        res.status(200).json({
            message: 'User updated successfully',
            user: userObject,
        })
    } catch (err) {
        console.error('Error updating user:', err)

        res.status(500).json({
            message: 'Error updating user',
            error: err.message,
        })
    }
})

/* ====================================================
   DELETE /user/:id/avatar
   Remove a user's avatar image and clear the DB field
   Example: DELETE /user/673b46a8.../avatar
  ===================================================== */
router.delete('/:id/avatar', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            })
        }

        // If the user currently has an avatar filename, delete the actual file
        if (user.avatar) {
            const avatarPath = path.join('public', 'avatars', user.avatar)

            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath)
            }
        }

        // Clear avatar field
        user.avatar = ''
        await user.save()

        res.status(200).json({
            message: 'Avatar removed',
        })
    } catch (err) {
        console.error('Error removing avatar:', err)
        res.status(500).json({
            message: 'Error removing avatar',
            error: err.message,
        })
    }
})

/* =================================================
   POST /user/:id/avatar
   Upload or change a user's avatar image
   Example: POST /user/673b46a8.../avatar
  ================================================== */
router.post('/:id/avatar', upload.single('avatar'), async (req, res) => {
    try {
        // No file sent
        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded',
            })
        }

        // Find the user
        const user = await User.findById(req.params.id)
        if (!user) {
            // Clean up temp file if user not found
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)

            return res.status(404).json({
                message: 'User not found',
            })
        }

        // Define final filename (overwrites any existing avatar file for this user)
        const finalFilename = `user_${user._id}.png`

        // Folder and final path
        const finalDir = path.join('public', 'avatars')
        const finalPath = path.join(finalDir, finalFilename)

        // Ensure avatars folder exists
        fs.mkdirSync(finalDir, {recursive: true})

        // Process image with sharp
        await sharp(req.file.path)
            .resize(300, 300, {fit: 'cover'})
            .png()
            .toFile(finalPath)

        // Remove temp file
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)

        // Save filename in DB
        user.avatar = finalFilename
        await user.save()

        res.status(200).json({
            message: 'Avatar uploaded successfully',
            filename: finalFilename,
        })
    } catch (err) {
        console.error('Error uploading avatar:', err)
        res.status(500).json({
            message: 'Error uploading avatar',
            error: err.message,
        })
    }
})

// Export this router so server.js can use it
module.exports = router