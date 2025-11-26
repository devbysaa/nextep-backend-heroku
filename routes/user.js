/* ==============================
   USER ROUTES
   This file defines all the HTTP endpoints for working with users
  ============================== */

/* ======== DEPENDENCIES ======= */

const express = require('express')

// Create a new router (mini Express app just for /user)
const router = express.Router()

// Import User model (blueprint for user data) to interact with MongoDB
const User = require('../models/user')

// Below four dependencies are for handling avatar image files
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const sharp = require('sharp')
const Utils = require("../Utils");

// multer will temporarily store avatar images in public/avatars (temp)
const upload = multer({ dest: 'uploads/' })

/* ==============================
   GET /user
   Get all users from the database
  ============================== */
router.get('/', async (req, res) => {
    try {
        // === FETCH USERS ===
        // Waits for MongoDB query to find all users and returns a promise
        const users = await User.find()

        // === SUCCESS RESPONSE ===
        // If successful, send the list of users back to the client in JSON format
        res.status(200).json(users);

        // === CATCH ERRORS ===
    } catch (err) {
        // If anything goes wrong (e.g. database connection issue), log error
        console.error('Error finding users:', err);

        // Send back an HTTP 500 (Internal Server Error) with a message
        res.status(500).json({
            message: 'Error finding users',
            error: err.message,
        });
    }
});

/* ===============================================
   GET /user/:id
   Retrieve a single user from MongoDB by their ID
  ================================================= */
router.get('/:id', async (req, res) => {
    try {
        // === FETCH USER ===
        // Use await to wait until MongoDB returns the user document
        // req.params.id comes from the URL (e.g. /user/673b46a8...)
        const user = await User.findById(req.params.id)

        // === CHECK IF USER EXISTS ===
        // If MongoDB didn't find a matching document, return a 400 Bad Request
        if (!user) {
            return res.status(400).json({
                message: 'User does not exist',
            })
        }

        // === SUCCESS RESPONSE ===
        // If found, send the user back in JSON format
        res.json(user)

        // === CATCH ERRORS ===
    } catch (err) {
        // Log if query fails (e.g. invalid ID format or DB issue)
        console.error('Error finding user:', err)

        // Send back a 500 Internal Server Error response
        res.status(500).json({
            message: 'Error finding user',
            error: err.message,
        })
    }
});

/* ====================================
   POST /user
   Create a new user and save to MongoDB
  ==================================== */
router.post('/', async (req, res) => {
    try {
        const { firstName, lastName, email, password, accessLevel, bio } = req.body

        // === VALIDATE INPUT ===
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                message: 'Missing required fields (firstName, lastName, email, password)',
            })
        }

        // === CHECK FOR EXISTING USER ===
        const existingUser = await User.findOne({ email })
        if (existingUser) { // Return 409 conflict status with error message
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

        // Generate JWT token for new user
        const token = Utils.generateAccessToken(userObject)

        // === SUCCESS RESPONSE ===
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
});

/* ======================================
   DELETE /user/:id
   Delete a user from MongoDB by their ID
  ====================================== */
router.delete('/:id', async (req, res) => {
    try {
        // === VALIDATE REQUEST PARAMS ===
        // Make sure the user ID is provided in the URL
        if (!req.params.id) {
            return res.status(400).json({
                message: 'User ID is missing',
            });
        }

        // === DELETE USER ===
        // Wait for MongoDB to find and delete the user document by ID
        const deletedUser = await User.findOneAndDelete({ _id: req.params.id })

        // === HANDLE NON-EXISTENT USER ===
        // If MongoDB didn't find a user with that ID, return a 404 Not Found
        if (!deletedUser) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        // === SUCCESS RESPONSE ===
        // If the user was found and deleted successfully, respond with a message
        res.json({
            message: 'User deleted successfully',
        });

    } catch (err) {
        // === ERROR HANDLING ===
        // If something goes wrong (invalid ID, DB issue, etc.), handle the error here
        console.error('Error deleting user:', err);

        // Respond with a 500 Internal Server Error and error details
        res.status(500).json({
            message: 'Error deleting user',
            error: err.message,
        });
    }
});

/* =============================================
   PUT /user/:id
   Update an existing user in MongoDB by their ID
  ============================================== */
router.put('/:id', async (req, res) => {
    try {
        // === VALIDATE REQUEST BODY ===
        // Ensure the request body is not empty before updating
        if (!req.body) {
            return res.status(400).json({
                message: 'User content is empty',
            });
        }

        // === PREPARE UPDATES ===
        // Avatar updates are handled separately (via /user/:id/avatar)
        const updates = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            bio: req.body.bio,
            accessLevel: req.body.accessLevel,
            newUser: req.body.newUser,
            password: req.body.password,
        };

        // === UPDATE USER ===
        // findByIdAndUpdate searches by ID and applies the updates
        // The option { new: true } means it returns the updated document
        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });

        // === HANDLE USER NOT FOUND ===
        // If no user exists with that ID, return a 404 Not Found
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        // Build user object
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

        // === SUCCESS RESPONSE ===
        // Send the updated user back to the client
        res.status(200).json({
            message: 'User updated successfully',
            user: userObject,
        })

        // === CATCH ERRORS ===
    } catch (err) {
        console.error('Error updating user:', err);

        // Send a 500 Internal Server Error with a clear message
        res.status(500).json({
            message: 'Error updating user',
            error: err.message,
        });
    }
});

/* ====================================================
   DELETE /user/:id/avatar
   Remove a user's avatar image and clear the DB field
   Example: DELETE /user/673b46a89c8f43e7d1f9a123/avatar
  ===================================================== */
router.delete('/:id/avatar', async (req, res) => {
    try {
        // === FIND USER ===
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            })
        }

        // === DELETE FILE FROM DISK (IF IT EXISTS) ===
        // If the user currently has an avatar filename, delete the actual file
        if (user.avatar) {
            const avatarPath = path.join('public', 'avatars', user.avatar);

            // Only delete if the file exists
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
            }
        }

        // === CLEAR AVATAR FIELD IN DB ===
        user.avatar = ''
        await user.save()

        // === SUCCESS RESPONSE ===
        res.status(200).json({
            message: 'Avatar removed',
        });

        // === CATCH ERRORS ===
    } catch (err) {
        console.error('Error removing avatar:', err);
        res.status(500).json({
            message: 'Error removing avatar',
            error: err.message,
        });
    }
});

/* =================================================
   POST /user/:id/avatar
   Upload or change a user's Profile.js avatar image
   Example: PUT /user/673b46a89c8f43e7d1f9a123/avatar
  ================================================== */
router.post('/:id/avatar', upload.single('avatar'), async (req, res) => {
    try {
        // === VALIDATE FILE UPLOAD ===
        // If no file was included in the request, stop and return 400
        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded',
            });
        }

        // === FIND THE USER ===
        // Look up the user that avatar belongs to
        const user = await User.findById(req.params.id);
        if (!user) {
            // If the user doesn't exist, delete the temp file to reduce clutter
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)

            return res.status(404).json({
                message: 'User not found',
            })
        }

        // === DEFINE FINAL FILE PATHS ===
        // Decide what to name the final image file (it will be user_id)
        const finalFilename = `user_${user._id}.png`

        // Build the folder and final path of where to store image
        // Stored in public/avatars/user_<id>.jpg
        const finalDir = path.join('public', 'avatars')
        const finalPath = path.join(finalDir, finalFilename)

        // Ensure the folder exists and create one if it doesn't
        fs.mkdirSync(finalDir, { recursive: true });

        /* === PROCESS IMAGE WITH SHARP ===
           Use sharp to:
           - Take the temp file (req.file.path)
           - Resize it to 300x300
           - Convert to png
           - Save to final path
        */
        await sharp(req.file.path)
            .resize(300, 300, { fit: 'cover' })
            .png()
            .toFile(finalPath);

        // === REMOVE TEMPORARY FILE ===
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)

        // === SAVE FILENAME TO DATABASE ===
        user.avatar = finalFilename;
        await user.save();

        // === SUCCESS RESPONSE ===
        res.status(200).json({
            message: 'Avatar uploaded successfully',
            filename: finalFilename,
        });

        // === CATCH ERRORS ===
    } catch (err) {
        console.error('Error uploading avatar:', err);
        res.status(500).json({
            message: 'Error uploading avatar',
            error: err.message,
        });
    }
});

// Export this router so server.js can use it
module.exports = router