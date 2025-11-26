// models/jobApplication.js

/* ==============================
   JOB APPLICATION MODEL
   This file defines the MongoDB structure for job applications.
   Each document in this collection represents a job application
   that belongs to a specific user
  ============================== */

// Import mongoose to define a schema and model
const mongoose = require('mongoose')

/* ==============================
   SCHEMA
   The schema describes what fields a job application has and
   what type each field is
  ============================== */

const jobApplicationSchema = new mongoose.Schema({
        /* ==========================
           REFERENCE TO USER
           - This links a job application to the user who created it
           - type: ObjectId → special MongoDB ID type
           - ref: 'User'  → tells Mongoose this ID refers to the User model
          ========================== */
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        /* ==========================
           BASIC JOB INFO
          ========================== */

        // Company name (e.g. "Google")
        company: {
            type: String,
            required: true,
            trim: true, // Remove extra spaces around the value
        },

        // Job position / title (e.g. "Frontend Developer")
        position: {
            type: String,
            required: true,
            trim: true,
        },

        // Job location (e.g. "Melbourne, VIC")
        location: {
            type: String,
            required: true,
            trim: true,
        },

        /* ==========================
           APPLICATION STATUS
           - Status controls which column it appears in the dashboard
           - Restrict this field to a set of allowed values using enum
          ========================== */
        status: {
            type: String,
            enum: ['applied', 'interviewing', 'offer', 'rejected'],
            default: 'applied',
            required: true,
        },

        /* ==========================
           SALARY RANGE
          ========================== */
        minSalary: {
            type: Number, // e.g. 20000
        },
        maxSalary: {
            type: Number, // e.g. 100000
        },

        /* ==========================
           DATES
          ========================== */

        // Date the application was submitted
        dateApplied: {
            type: Date,
            required: true,
        },

        // Optional interview date
        interviewDate: {
            type: Date,
        },

        // Optional interview time (stored as a string like "14:30")
        interviewTime: {
            type: String,
        },

        /* ==========================
           EXTRA INFO
          ========================== */

        // Link to the job posting (e.g. "https://careers.google.com/..."), optional
        jobUrl: {
            type: String,
            default: '',
            trim: true,
        },

        // Notes about this application
        notes: {
            type: String,
            default: '',
        },

        // Filenames for uploaded documents (e.g. CVs)
        documents: [
            {
                type: String, // e.g. "cv_user_12345.pdf"
            },
        ],
    },
    {
        // This option automatically adds:
        // - createdAt: date when the document was created
        // - updatedAt: date when the document was last updated
        timestamps: true,
    })

/* ==============================
   MODEL
   - This creates the model class
   - 'JobApplication' will become the collection 'jobapplications'
   - This model is used in routes to create/find/update/delete applications
  ============================== */

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema)

// Export the model so other files (like routes) can use it
module.exports = JobApplication