/** Codeforces Sync Cron Job
 
 This scheduled job performs the following:
  1. Syncs Codeforces data (profile, contests, submissions) for all students
     according to the configured sync frequency and time.
  2. Detects inactive students (no CF submissions in last 7 days).
  3. Sends automated reminder emails to inactive students.
   4. Logs reminder email activity into the database (`InactivityLog`).
 
 Configuration:
  - Frequency (`daily`, `weekly`, `monthly`) and time (`HH:mm`) stored in `sync_config` collection.
  - Cron runs every minute but only acts when the current time ≈ configured time.
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const Student = require('../db/student');
const SyncCodeforcesData = require('../controllers/codeforcesController');
const SyncConfig = require('../db/syncConfig');
const sendReminderEmail = require('../utils/sendRemainderEmail');
const InactivityLog = require('../db/inactivityLog'); 

/**
 * Starts the Codeforces cron job which:
 * - Syncs CF data based on config
 * - Sends inactivity reminders
 * - Logs reminder activity
 */
function startCodeforcesCron() {
  cron.schedule('* * * * *', async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        console.warn('⚠️ Skipping Codeforces cron run because MongoDB is not connected.');
        return;
      }

      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday
      const currentDate = now.getDate(); // 1–31

      // STEP 1: Get sync configuration
      const config = await SyncConfig.findOne();
      if (!config) {
        console.warn("⚠️ No sync config found. Skipping Codeforces sync.");
        return;
      }

      const { frequency, time } = config;

      // STEP 2: Compare current time with configured time.
      // The job runs every minute, so this keeps execution close to the admin-selected minute.
      const [confHour, confMin] = time.split(':').map(Number);
      const confTime = new Date(now);
      confTime.setHours(confHour, confMin, 0, 0);

      const diffInMinutes = Math.abs(now - confTime) / (1000 * 60);
      if (diffInMinutes > 1) return; // Skip if not within ±1 minute window

      // STEP 3: Check if today matches sync frequency
      let shouldSync = false;
      if (frequency === 'daily') shouldSync = true;
      else if (frequency === 'weekly' && currentDay === 1) shouldSync = true; // Monday
      else if (frequency === 'monthly' && currentDate === 1) shouldSync = true; // 1st day

      if (!shouldSync) {
        console.log(`⏳ Skipping CF sync: not the right day for ${frequency} sync.`);
        return;
      }

      console.log(`⏰ Running Codeforces sync for all students at ${time} (${frequency})`);

      // STEP 4: Get all students with valid Codeforces handle
      const students = await Student.find({ cfHandle: { $exists: true, $ne: '' } });

      // STEP 5: Sync data for each student
      for (const student of students) {
        try {
          await SyncCodeforcesData(student._id.toString());
          console.log(`✅ Synced ${student.cfHandle}`);
        } catch (err) {
          console.error(`❌ Failed to sync ${student.cfHandle}:`, err.message);
        }
      }

      // STEP 6: Find students inactive for 7+ days
      const inactiveThreshold = new Date();
      inactiveThreshold.setDate(inactiveThreshold.getDate() - 7);

      const reminderCooldown = new Date();
      reminderCooldown.setDate(reminderCooldown.getDate() - 7);

      const inactiveStudents = await Student.find({
        emailReminderDisabled: { $ne: true },
        $and: [
          {
            $or: [
              { lastSubmissionDate: { $exists: false } },
              { lastSubmissionDate: { $lt: inactiveThreshold } }
            ]
          },
          {
            $or: [
              { lastReminderSentAt: { $exists: false } },
              { lastReminderSentAt: { $lt: reminderCooldown } }
            ]
          }
        ]
      });

      // STEP 7: Send reminder emails and log activity
      for (const student of inactiveStudents) {
        try {
          await sendReminderEmail(student.email, student.name);

          // Increment reminder count
          student.reminderCount = (student.reminderCount || 0) + 1;
          student.lastReminderSentAt = new Date();
          await student.save();

          // Log this activity
          await InactivityLog.create({
            studentId: student._id,
            email: student.email,
            lastActive: student.lastSubmissionDate,
            mailSentAt: new Date(),
            reason: "No CF submission in last 7 days",
          });

          console.log(`📧 Reminder sent to ${student.email}`);
        } catch (err) {
          console.error(`❌ Email send failed for ${student.email}:`, err.message);
        }
      }

    } catch (err) {
      console.error("🔥 Fatal error in Codeforces cron job:", err.message);
    }
  });
}

module.exports = startCodeforcesCron;
