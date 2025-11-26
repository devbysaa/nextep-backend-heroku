/* ==============================
   JOB APPLICATION ROUTES
   Endpoints for creating, reading, updating, deleting
   and downloading job applications and related documents
   ============================== */

const express = require('express')
const router = express.Router()

// Import JobApplication model
const JobApplication = require('../models/jobApplication')

// Node path module is used to construct absolute file system paths safely
const path = require('path')

// File system module is used to ensure upload directory exists
const fs = require('fs')

// Multer is used to handle multipart/form-data file uploads
const multer = require('multer')

// Load environment variables (e.g. SECRET_KEY if needed later)
require('dotenv').config()

/* ==============================
   DOCUMENT UPLOAD CONFIGURATION
   Files are stored on disk under:
   <project-root>/public/documents

   Frontend sends files under the field name "documents"
   using multipart/form-data
   ============================== */

// Build absolute path to public/documents folder from this routes directory
const documentsDir = path.join(__dirname, '..', 'public', 'documents')

// Ensure that public/documents exists before handling any uploads
// recursive: true allows creation of nested directories if necessary
if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true })
}

// Multer disk storage configuration
const storage = multer.diskStorage({
    // Destination determines where files are stored on disk
    destination: (req, file, cb) => {
        cb(null, documentsDir)
    },
    // Filename determines the name of the stored file
    filename: (req, file, cb) => {
        // file.originalname preserves the original name (e.g. "cv.pdf")
        cb(null, file.originalname)
    },
})

// Multer instance configured to accept multiple "documents" files
const upload = multer({ storage })

/* ==============================
   POST /documents/upload
   Upload one or more job-application documents

   Full URL from frontend:
   POST {App.apiBase}/job-application/documents/upload

   Expected request:
   - Content-Type: multipart/form-data
   - Field name: "documents"
   - Value: one or more File objects
   ============================== */

router.post('/documents/upload', upload.array('documents', 10), (req, res) => {
    // req.files is an array of file info objects created by multer
    const files = req.files || []

    // Map stored file metadata to an array of filenames
    // This array is saved in the MongoDB "documents" field on the JobApplication
    const fileNames = files.map(file => file.filename)

    return res.status(200).json({
        message: 'Documents uploaded successfully',
        fileNames,
    })
})

/* ==============================
   GET /documents/:fileName
   Download or view a stored document by file name for a job application

   Full URL from frontend:
   GET {App.apiBase}/job-application/documents/:fileName

   Example:
   GET /job-application/documents/infrabuild-job-description.pdf

   Files are expected under:
   <project-root>/public/documents/<fileName>

   Important route ordering note:
   This route is defined before GET '/:userId' so that "documents"
   is not misinterpreted as a userId parameter.
   ============================== */

router.get('/documents/:fileName', (req, res) => {
    const { fileName } = req.params

    // Basic validation for fileName presence
    if (!fileName) {
        return res.status(400).json({
            message: 'File name is required',
        })
    }

    // Construct absolute path to the requested file
    const filePath = path.join(documentsDir, fileName)

    // Log final resolved path for debugging
    console.log('Resolved document path:', filePath)

    // sendFile streams the file to the client
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error sending document:', err)

            // ENOENT indicates the file does not exist at the resolved path
            if (err.code === 'ENOENT') {
                return res.status(404).json({
                    message: 'Document not found',
                })
            }

            // Any other error becomes a generic 500
            return res.status(500).json({
                message: 'Error downloading document',
            })
        }
    })
})

/* ==============================
   POST /
   Create a new job application document

   Full URL from frontend:
   POST {App.apiBase}/job-application

   The frontend sends a JSON body like:
   {
     user: "<userId string>",
     company: "Google",
     position: "Developer",
     location: "Melbourne",
     status: "applied",
     minSalary: "30000",
     maxSalary: "40000",
     dateApplied: "2025-11-24",
     interviewDate: "2025-11-30",
     interviewTime: "14:30",
     jobUrl: "https://...",
     notes: "Some notes",
     documents: ["cv.pdf", "cover-letter.pdf"] // uploaded earlier
   }
   ============================== */

router.post('/', async (req, res) => {
    try {
        // Destructure fields from the request body.
        // "user" contains the userId string sent by the frontend.
        const {
            user: userId,
            company,
            position,
            location,
            status,
            minSalary,
            maxSalary,
            dateApplied,
            interviewDate,
            interviewTime,
            jobUrl,
            notes,
            documents,
        } = req.body

        // Backend validation for required fields
        if (!company || !position || !location || !status || !userId || !dateApplied) {
            console.log('Company, position, location, date applied, status, and userId are required')

            return res.status(400).json({
                // Message designed to be displayed as a toast in the frontend
                message: 'Company, position, location, status are required',
            })
        }

        // Build the new JobApplication document
        const jobApplication = new JobApplication({
            // Link to the user who created the application
            user: userId,

            // Basic job info
            company,
            position,
            location,

            // Status (default to "applied" if something unexpected is sent)
            status: status || 'applied',

            // Salary values:
            // If empty strings come from frontend, use undefined so that values are not stored
            minSalary: minSalary || undefined,
            maxSalary: maxSalary || undefined,

            // Convert date strings (e.g. "2025-11-24") into Date objects if provided
            dateApplied: dateApplied ? new Date(dateApplied) : undefined,
            interviewDate: interviewDate ? new Date(interviewDate) : undefined,

            // Time is kept as a simple string like "14:30"
            interviewTime: interviewTime || '',

            // Optional URL and notes
            jobUrl: jobUrl || '',
            notes: notes || '',

            // Documents are stored as an array of filenames (strings)
            documents: Array.isArray(documents) ? documents : [],
        })

        // Save the job application to MongoDB
        const saved = await jobApplication.save()

        // Respond with 201 Created and the saved document
        res.status(201).json({
            message: 'Job application created successfully',
            jobApplication: saved,
        })

    } catch (err) {
        console.error('Error creating job application:', err)

        res.status(500).json({
            message: 'Error creating job application',
            error: err.message,
        })
    }
})

/* ==============================
   GET /:userId
   Retrieve all job applications for a user,
   sorted by newest first (most recent createdAt first)

   Full URL from frontend:
   GET {App.apiBase}/job-application/:userId

   Example:
   GET /job-application/691cfc1d825a123fa5d81054
   ============================== */

router.get('/:userId', async (req, res) => {
    try {
        // Read userId from URL path parameters
        const { userId } = req.params

        // If userId is missing, return a 400 Bad Request
        if (!userId) {
            return res.status(400).json({
                message: 'UserId is required',
            })
        }

        // Find all job applications that belong to this user
        // Sort them by createdAt descending so newest is at the top
        const applications = await JobApplication.find({ user: userId })
            .sort({ createdAt: -1 })

        // Respond with the list of applications
        res.status(200).json({
            message: 'Job applications retrieved successfully',
            applications,
        })

    } catch (err) {
        console.error('Error retrieving job applications:', err)

        res.status(500).json({
            message: 'Error retrieving job applications',
            error: err.message,
        })
    }
})

/* ==============================
   PUT /:id
   Update an existing job application
   ============================== */

router.put('/:id', async (req, res) => {
    try {
        // Job application id from URL parameter
        const jobId = req.params.id

        // Pull updated values from the body
        const {
            user: userId,
            company,
            position,
            location,
            status,
            minSalary,
            maxSalary,
            dateApplied,
            interviewDate,
            interviewTime,
            jobUrl,
            notes,
            documents,
        } = req.body

        // Backend validation for required fields
        if (!company || !position || !location || !status || !userId) {
            return res.status(400).json({
                message: 'Company, position, location, date applied, status and user are required',
            })
        }

        // Build a plain update object
        const update = {
            user: userId,
            company,
            position,
            location,
            status,
            minSalary: minSalary || undefined,
            maxSalary: maxSalary || undefined,
            dateApplied: dateApplied ? new Date(dateApplied) : undefined,
            interviewDate: interviewDate ? new Date(interviewDate) : undefined,
            interviewTime: interviewTime || '',
            jobUrl: jobUrl || '',
            notes: notes || '',
            documents: Array.isArray(documents) ? documents : [],
        }

        // Find the job by id and update it
        const updated = await JobApplication.findByIdAndUpdate(
            jobId,
            update,
            { new: true } // new: true returns the updated document instead of the old one
        )

        // If no record was found, return 404 Not Found
        if (!updated) {
            return res.status(404).json({
                message: 'Job application not found',
            })
        }

        // Respond with the updated job application
        res.status(200).json({
            message: 'Job application updated successfully',
            jobApplication: updated,
        })

    } catch (err) {
        console.error('Error updating job application:', err)
        res.status(500).json({
            message: 'Error updating job application',
            error: err.message,
        })
    }
})

/* ==============================
   DELETE /:id
   Delete an existing job application
   ============================== */

router.delete('/:id', async (req, res) => {
    try {
        // Job application id from URL parameter
        const jobId = req.params.id

        // Attempt to delete the document
        const deleted = await JobApplication.findByIdAndDelete(jobId)


        // Confirm successful deletion
        res.status(200).json({
            message: 'Job application deleted successfully',
        })

    } catch (err) {
        console.error('Error deleting job application:', err)
        res.status(500).json({
            message: 'Error deleting job application',
            error: err.message,
        })
    }
})

/* ==============================
   EXPORT ROUTER
   This router is mounted in server.js as:
   app.use('/job-application', jobApplicationRoutes)
   ============================== */

module.exports = router