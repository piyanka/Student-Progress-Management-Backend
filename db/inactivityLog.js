const mongoose = require("mongoose");

const inactivityLogSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
  },
  email: String,
  lastActive: Date,
  mailSentAt: Date,
  reason: String
}, { timestamps: true });

module.exports = mongoose.model("inactivityLog", inactivityLogSchema);
