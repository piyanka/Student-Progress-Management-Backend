const mongoose = require('mongoose');

const codeforcesDataSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'students',
        required: true,
        unique: true
    },
    info: {
        handle: String,
        rating: Number,
        maxRating: Number,
        rank: String,
        maxRank: String,
        avatar: String,
    },
    ratingHistory: [
        {
            contestId: Number,
            contestName: String,
            rank: Number,
            oldRating: Number,
            newRating: Number,
            ratingUpdateTimeSeconds: Number
        }
    ],
    submissions: [
        {
            id: Number,
            contestId: Number,
            problem: {
                name: String,
                index: String,
                rating: Number,
                tags: [String]
            },
            verdict: String,
            creationTimeSeconds: Number
        }
    ],
    lastSynced: {
        type: Date,
        default: Date.now
    },
    inactivityReminderCount: {
        type: Number,
        default: 0
    },
    disableReminder: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('codeforces_datas', codeforcesDataSchema);
