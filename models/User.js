/* ========== DEPENDENCIES ========== */

// Import the Mongoose library
// Mongoose is an ODM (Object Data Modeling) library that makes it easier
// to work with MongoDB in Node.js
const mongoose = require('mongoose')

// Import the "mongoose-type-email" plugin
// This adds built-in validation for email fields so only valid email formats are accepted
require('mongoose-type-email')

// Import utility functions (e.g., password hashing) from utils.js
const Utils = require('../Utils')


/* ============= SCHEMA ============= */

// Create a new schema for the User collection
// This defines what fields each User document will have and their rules
const userSchema = new mongoose.Schema({
    // User's first name
    firstName: {
        type: String, // Must be a string
        required: true, // This field is mandatory
    },
    // User's last name
    lastName: {
        type: String,
        required: true,
    },
    // User's email address
    email: {
        type: mongoose.SchemaTypes.Email, // Must be a valid email
        required: true,
        unique: true,
    },
    // User's password
    password: {
        type: String, // Must be a string
        required: true,
    },
    bio: {
        type: String,
        default: '', // Empty string if bio is not provided
    },
    // User's avatar stored as a string of the file name
    avatar: {
        type: String,
        default: '', // Avatar empty if user hasn't uploaded yet
    },
    // User's access level (e.g., 0 = regular user, 1 = admin)
    accessLevel: {
        type: Number, // Must be a number
        required: true,
    },
    // Flag to indicate whether the user is new (for first-time guide)
    newUser: {
        type: Boolean,
        default: true,
    },
    // The "timestamps: true" option automatically adds two fields:
    // - createdAt: the date/time when the document was created
    // - updatedAt: the date/time when the document was last updated
}, { timestamps: true })


/* ============= MIDDLEWARE ============== */

/* Define a pre-save middleware for the User schema
  'pre' means this function will run before a document is saved into MongoDB
   Middleware here is used so that the password can be hashed every time a user
   is created or their password is changed */
userSchema.pre('save', function (next) {

    // 'this' refers to the current User document being saved
    // Check if the password exists AND if it has been modified
    if (this.password && this.isModified('password')) {

        // Replace the plain text password with a hashed version
        this.password = Utils.hashPassword(this.password)
    }

    // Call next() to tell Mongoose that this middleware is finished
    next()
})


/* ============= MODEL ============== */

// Create the model (object that allows interaction with the database)
// 'User' = the name of the model (Mongoose will make it lowercase and plural -> 'users' collection)
// UserSchema = the structure/blueprint defined above
const userModel = mongoose.model('User', userSchema)

// Export the model so it can be used in other files (like routes/user.js)
module.exports = userModel