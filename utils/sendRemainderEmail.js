/** Automated Reminder Email Sender
 
 This module sends an inactivity reminder email to students who haven't made a Codeforces submission in the last 7 days.
 It uses Nodemailer and environment variables for credentials.

*/

const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a reusable transporter object using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,                                     // e.g., smtp.gmail.com
  port: process.env.EMAIL_PORT,                                     // 587 (TLS) or 465 (SSL)
  secure: false,                                                    // true for port 465, false for others
  auth: {
    user: process.env.EMAIL_USER,                                   // Sender email address
    pass: process.env.EMAIL_PASS                                    // App password or email password
  }
});

// Send inactivity reminder email  to - Recipient email address,  name - Student's name

const sendReminderEmail = async (to, name) => {
  const subject = "⏳ Let's get back to solving problems!";
  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333;">
      <p>Hi <strong>${name}</strong>,</p>
      <p>We noticed you haven’t submitted any Codeforces problems in the past <strong>7 days</strong>.</p>
      <p>Let’s keep the momentum going! 🚀</p>
      <p>Time to get back to the grind 💪</p>
      <hr />
      <p style="font-size: 13px; color: #888;">This is an automated reminder from the Student Progress Manager system.</p>
    </div>
  `;

  try {
    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,                                                                     // Sender name and address
      to,
      subject,
      html
    });
    console.log(`📧 Reminder email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
  }
};

module.exports = sendReminderEmail;
