require('dotenv').config();

// Required Modules
const express = require("express");
const cors = require("cors");
const bcrypt = require('bcrypt');
const Jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Local files
const connectDB = require('./db/config');
const User = require('./db/user');
const Student = require('./db/student');
const CodeforcesData = require('./db/codeforcesData');
const SyncConfig = require('./db/syncConfig');
const SyncCodeforcesData = require("./controllers/codeforcesController");
const startCodeforcesCron = require('./jobs/codeforcesCron');
const InactivityLog = require('./db/inactivityLog'); 
                                                         
const app = express();
app.use(express.json());
app.use(cors());

const JwtKey = process.env.JWT_SECRET || 'ed-tech';
const PORT = process.env.PORT || 5000;
const DEFAULT_SYNC_CONFIG = { frequency: "daily", time: "02:00" };
const API_ENDPOINTS = [
  { method: "POST", path: "/register", auth: false, purpose: "Create a user account" },
  { method: "POST", path: "/login", auth: false, purpose: "Authenticate a user" },
  { method: "GET", path: "/students", auth: true, purpose: "List students with pagination" },
  { method: "POST", path: "/students/add", auth: true, purpose: "Add a student" },
  { method: "GET", path: "/students/:id", auth: true, purpose: "Get one student" },
  { method: "PUT", path: "/students/:id", auth: true, purpose: "Update a student" },
  { method: "DELETE", path: "/students/:id", auth: true, purpose: "Delete a student" },
  { method: "GET", path: "/students/search/:key", auth: true, purpose: "Search students" },
  { method: "GET", path: "/students/:id/codeforces", auth: true, purpose: "Sync and fetch Codeforces data" },
  { method: "GET", path: "/sync/:studentId", auth: true, purpose: "Trigger a manual sync" },
  { method: "GET", path: "/sync-config", auth: true, purpose: "Read sync schedule" },
  { method: "POST", path: "/sync-config", auth: true, purpose: "Update sync schedule" },
  { method: "GET", path: "/inactivity-logs", auth: true, purpose: "View reminder logs" },
  { method: "GET", path: "/health", auth: false, purpose: "Backend health check" },
];

// Authentication Middleware
function verifyToken(req, res, next) {
  let token = req.headers["authorization"];
  if (token) {
    token = token.split(" ")[1];
    Jwt.verify(token, JwtKey, (err, valid) => {
      if (err) {
        return res.status(401).json({ result: "Invalid token" });
      } else {
        next();
      }
    });
  } else {
    return res.status(403).json({ result: "Token missing" });
  }
}

// Register User
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "User with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let user = new User({ name, email, password: hashedPassword });
    let result = await user.save();
    result = result.toObject();
    delete result.password;

    Jwt.sign({ result }, JwtKey, { expiresIn: '2h' }, (err, token) => {
      if (err) {
        return res.status(500).json({ error: "Something went wrong, please try again later." });
      }
      else {
        res.status(201).json({ result, auth: token });
      }
      // resp.send({result, auth: token});
    })

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed. Please try again later." });
  }
});

// Login User
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Compare entered password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    
    Jwt.sign({ user: userWithoutPassword }, JwtKey, { expiresIn: '2h' }, (err, token) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "Something went wrong, please try again later." });
      }
      res.status(200).json({ user: userWithoutPassword, auth: token });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed. Please try again later." });
  }
});

// Get All Students (Pagination)
app.get('/students', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    const total = await Student.countDocuments();
    const students = await Student.find().skip(skip).limit(limit);

    // Attach lastSynced from codeforces_data
    const studentsWithSync = await Promise.all(
      students.map(async (student) => {
        const cfData = await CodeforcesData.findOne({ student: student._id });
        return {
          ...student._doc,
          lastSynced: cfData?.lastSynced || null
        };
      })
    );

    res.json({
      students: studentsWithSync,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to fetch students." });
  }
});

// Add a New Student
app.post('/students/add', verifyToken, async (req, resp) => {
  try {
    const studentData = req.body;

    const requiredFields = ['name', 'email', 'phone', 'cfHandle', 'currentRating', 'maxRating', 'userId'];
    for (const field of requiredFields) {
      if (!studentData[field]) {
        return resp.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    const student = new Student(studentData);
    const result = await student.save();
    resp.status(201).json(result);
  } catch (err) {
    console.error(err);
    resp.status(500).json({ error: 'Failed to add student' });
  }
});

// Get Student by ID
app.get('/students/:id', verifyToken, async (req, resp) => {
  try {
    const result = await Student.findById(req.params.id);
    if (result) {
      resp.send(result);
    } else {
      resp.status(404).send({ result: "No Result Found" });
    }
  } catch (err) {
    resp.status(500).send({ error: "Server error while fetching student." });
  }
});

// Update Student by ID 
app.put('/students/:id', verifyToken, async (req, res) => {
  try {
    const studentId = req.params.id;
    const updateData = req.body;

    // Step 1: Get existing student
    const oldStudent = await Student.findById(studentId);
    if (!oldStudent) {
      return res.status(404).json({ error: "Student not found." });
    }

    // Step 2: Update student
    const result = await Student.updateOne(
      { _id: studentId },
      { $set: updateData }
    );

    // Step 3: If cfHandle changed, trigger real-time sync
    if (updateData.cfHandle && updateData.cfHandle !== oldStudent.cfHandle) {
      await SyncCodeforcesData(studentId);
      console.log(`🔄 CF handle changed, triggered sync for student ${studentId}`);
    }

    // Step 4: Send response
    if (result.modifiedCount > 0) {
      res.status(200).json({ success: true, message: "Student updated and synced (if needed)." });
    } else if (result.matchedCount === 0) {
      res.status(404).json({ error: "Student not found." });
    } else {
      res.status(200).json({ success: true, message: "No changes were made." });
    }

  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ error: "Something went wrong while updating the student." });
  }
});


// Get Codeforces data for a student
app.get('/students/:id/codeforces', verifyToken, async (req, res) => {
  try {
    const studentId = req.params.id;

    await SyncCodeforcesData(studentId);                                          // sync but don't send res

    const data = await CodeforcesData.findOne({ student: studentId });

    if (!data) {
      return res.status(404).json({ error: "No Codeforces data found after sync." });
    }

    res.status(200).json(data);

  } catch (err) {
    console.error("Error during sync or fetch:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || "Failed to fetch Codeforces data." });
    }
  }
});

// Real-time Sync Codeforces Data for a Student
app.get('/sync/:studentId', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate format (must be 24-char MongoDB ObjectId)
    if (!studentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid student ID format' });
    }

    await SyncCodeforcesData(studentId);

    res.status(200).json({ success: true, message: 'Codeforces data synced successfully' });
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to sync Codeforces data' });
  }
});

// Change sync time/frequency
app.post('/sync-config', verifyToken, async (req, res) => {
  const { frequency, time } = req.body;

  // Step 1: Validate input
  const validFrequencies = ['daily', 'weekly', 'monthly'];
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // Matches "HH:mm"

  if (!validFrequencies.includes(frequency)) {
    return res.status(400).json({ error: 'Invalid frequency. Use daily, weekly, or monthly.' });
  }

  if (!timeRegex.test(time)) {
    return res.status(400).json({ error: 'Invalid time format. Expected HH:mm (24-hour format).' });
  }

  try {
    // Step 2: Update existing config or create a new one
    const existingConfig = await SyncConfig.findOne();
    if (existingConfig) {
      existingConfig.frequency = frequency;
      existingConfig.time = time;
      await existingConfig.save();
      return res.status(200).json({ success: true, config: existingConfig });
    } else {
      const config = await SyncConfig.create({ frequency, time });
      return res.status(200).json({ success: true, config });
    }
  } catch (err) {
    console.error('Failed to update sync config:', err);
    res.status(500).json({ error: 'Failed to update sync configuration.' });
  }
});

// GET /sync-config
app.get('/sync-config', verifyToken, async (req, res) => {
  try {
    const config = await SyncConfig.findOne();
    if (!config) {
      return res.status(200).json({ success: true, config: DEFAULT_SYNC_CONFIG });
    }

    res.status(200).json({ success: true, config });
  } catch (err) {
    console.error('Failed to fetch sync config:', err);
    res.status(500).json({ error: 'Failed to fetch sync config.' });
  }
});


// Delete a Student by ID
app.delete('/students/:id', verifyToken, async (req, resp) => {
  try {
    const result = await Student.deleteOne({ _id: req.params.id });
    if (result.deletedCount > 0) {
      resp.send({ success: true, message: "Student deleted." });
    } else {
      resp.status(404).send({ error: "Student not found." });
    }
  } catch (err) {
    resp.status(500).send({ error: "Failed to delete student." });
  }
});

// Search Students by name/email/handle/phone
app.get('/students/search/:key', verifyToken, async (req, resp) => {
  try {
    const result = await Student.find({
      "$or": [
        { name: { $regex: req.params.key, $options: 'i' } },
        { email: { $regex: req.params.key, $options: 'i' } },
        { cfHandle: { $regex: req.params.key, $options: 'i' } },
        { phone: { $regex: req.params.key, $options: 'i' } }
      ]
    });
    resp.send(result);
  } catch (err) {
    resp.status(500).send({ error: "Search failed." });
  }
});



// Get inactivity log 
app.get('/inactivity-logs', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await InactivityLog.countDocuments();

    const logs = await InactivityLog.find()
      .populate('studentId', 'name email')  // Get name & email from referenced student
      .sort({ mailSentAt: -1 })             // Show recent first
      .skip(skip)
      .limit(limit);

    res.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });

  } catch (err) {
    console.error("❌ Error fetching inactivity logs:", err.message);
    res.status(500).json({ error: "Failed to fetch inactivity logs." });
  }
});

// Start Server
app.get("/", (req, res) => res.send("Student Progress System Running"));

app.get("/health", async (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const syncConfig = dbReady
    ? await SyncConfig.findOne().lean().catch(() => null)
    : null;

  res.status(dbReady ? 200 : 503).json({
    success: dbReady,
    status: dbReady ? "ok" : "degraded",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      connected: dbReady,
      readyState: mongoose.connection.readyState,
    },
    services: {
      auth: true,
      cron: true,
      inactivityEmail: true,
      codeforcesSync: true,
    },
    syncConfig: syncConfig || DEFAULT_SYNC_CONFIG,
    endpoints: API_ENDPOINTS,
  });
});

async function startServer() {
  try {
    await connectDB();
    startCodeforcesCron();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

startServer();
