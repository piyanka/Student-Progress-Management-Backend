// syncConfig.js
const mongoose = require('mongoose');

const syncConfigSchema = new mongoose.Schema({
    frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'daily'
    },
    time: {
        type: String, // Format: HH:mm
        default: '02:00',
        validate: {
            validator: function (value) {
                // Regex for 24-hour format HH:mm
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
            },
            message: props => `${props.value} is not a valid time format (HH:mm)`
        }
    }
});

module.exports = mongoose.model('sync_config', syncConfigSchema);
