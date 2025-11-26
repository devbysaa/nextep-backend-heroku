/* ============= DEPENDENCIES ============= */

// Import Node.js's built-in 'crypto' library, which provides functionality
// like hashing, encryption, random number generation, etc
let crypto = require('crypto')

// Import the jsonwebtoken library
// This library is used to create (sign) and check (verify) JWT tokens for authentication
const jsonWebToken = require('jsonwebtoken')

// Load environment variables from the .env file into process.env
require('dotenv').config()


/* ============= UTILS CLASS ============= */

/* Create a Utils class to group related utility functions together.
   In this case, the utility functions are about securely handling passwords.
   This makes it easy to reuse them anywhere in the project */
class Utils {

    // Convert a plain text password into a hash to safely store in MongoDB
    hashPassword(password) {
        /* Generate a "salt" (a random piece of data added to the password)
           randomBytes(16) - creates 16 random bytes of data
           toString('hex') - converts those bytes into a hexadecimal string */
        const salt = crypto.randomBytes(16).toString('hex')

        /* Hash the password using PBKDF2 (Password-Based Key Derivation Function 2)
           Parameters:
           password - the plain text password entered by the user
           salt - the random salt just generated
           2048 - the number of times the hash is repeated
           32 - the length of the final hash in bytes
           sha512 - the hashing algorithm to use */
        const hash = crypto.pbkdf2Sync(password, salt, 2048, 32, "sha512").toString('hex')

        /* Combine salt and hash into a single string to be stored together
           Example: "randomSalt$hashedPassword"
           For cases when users have the same password, which generates the same hash */
        return [salt, hash].join('$')
    }

    // Check if a plain text password matches the stored hash
    verifyPassword(password, original) {
        // The stored "original" value looks like "salt$hash"
        // Extract the "hash" part (after the $ symbol)
        const originalHash = original.split('$')[1]

        // Extract the "salt" part (before the $ symbol)
        const salt = original.split('$')[0]

        /* Hash the plain text password using the same salt and parameters
           This ensures that if the password is correct, the result will match
           the original hash stored in the database */
        const hash = crypto.pbkdf2Sync(password, salt, 2048, 32, "sha512").toString('hex')

        /* Compare the newly computed hash with the original stored hash
           If they are exactly the same, the password is correct - return true
           If not, the password is incorrect - return false */
        return hash === originalHash
    }

    generateAccessToken(user) {
        return jsonWebToken.sign({ user: user }, process.env.SECRET_KEY, { expiresIn: '30min' })
    }
}


/* ============= EXPORT ============= */

// Create a single instance of the Utils class (using "new Utils()")
// and export it so other files in the project can use these methods.
module.exports = new Utils();