const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: [true, "Please enter a password"],
            minLength: [6, "Password must be at least 6 characters long"]
        },

    }, 
    { timestamps: true });


module.exports = mongoose.model("User", userSchema);