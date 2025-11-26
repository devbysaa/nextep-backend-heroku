/* ==============================
   DEPENDENCIES
  ============================== */
// Load variables from the .env file and make them available in process.env for use
// in the app
require('dotenv').config()

// Other dependencies
const bodyParser = require('body-parser')
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')

// Use the port specified in environment if available, otherwise default to 3000
const port = process.env.PORT || 3000

/* ==============================
   DATABASE CONNECTION
  ============================== */
// Connect to MongoDB using connection string stored in environment variable. This
// code is asynchronous, which will return a Promise
mongoose.connect(process.env.MONGODB_URI)
    // If the Promise was successful (connection to the database), print out 'DB connected!'
    .then(() => {
        console.log('DB connected!')
    })
    // If the Promise was not successful, print 'DB connection failed!' along with the error
    .catch((err) => {
        console.log('DB connection failed!', err)
    })

/* ==============================
   EXPRESS APP SET UP
  ============================== */
// Set up Express web server object that has in-built methods to handle HTTP requests
// and responses
const app = express()

// Allow any file inside the 'public' folder become accessible in the browser
app.use(express.static(path.join(__dirname, 'public')));

/* bodyParser.json() -> creates a middleware function that parses incoming JSON data
   into a Javascript object
   app.use() -> register the middleware in Express so it runs on every request */
app.use(bodyParser.json())

/* Creates a middleware function that parses data sent from HTML forms that are in
   URL-encoded format (E.g. name=John&email=john@example.com), into a Javascript
   object. This middleware will run on every request */
app.use(bodyParser.urlencoded({ extended: true }))

/* '/{*any}' means to match any path after the root '/'. cors() (Cross-Origin Resource
   Sharing) allows requests from different domains to access any route within the app */
app.use('/{*any}', cors())

/* ==============================
   ROUTES
  ============================== */
// Define a route that responds to GET requests. When someone visits the root URL ('/'),
// send back the text 'This is the homepage'
app.get('/', (req, res) => {
    res.send('This is the homepage')
})

// Import the user and auth routers from routes directory
const userRouter = require('./routes/user')
const authRouter = require('./routes/auth')
const jobApplicationRoutes = require('./routes/jobApplication')

// user route -> Whenever a request path begins with '/user', it gets passed to the
// userRouter to handle. userRouter is imported from ./routes/user
app.use('/user', userRouter)

// For all request paths that begin with '/auth'
app.use('/auth', authRouter)

// For all request paths that begin with '/jobApplication'
app.use('/job-application', jobApplicationRoutes)

/* ==============================
   RUN APP
  ============================== */
// Start the Express server. After it starts, log a message to confirm it's running
app.listen(port, () =>{
    console.log('App is running on port', port)
})