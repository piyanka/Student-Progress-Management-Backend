const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: true
    },
    cfHandle: {
        type: String,
        index: true,
        required: true
    },
    currentRating: {
        type: Number,
        required: true
    },
    maxRating: {
        type: Number,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    codeforcesData: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'codeforces_data',  // referencing the separate schema
        default: null
    },
    reminderCount: {
        type: Number,
        default: 0
    },
    emailReminderDisabled: {
        type: Boolean,
        default: false
    },
    lastSubmissionDate: {
        type: Date
    }

}, { timestamps: true });

module.exports = mongoose.model('students', studentSchema);
