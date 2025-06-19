/** syncCodeforcesData - Fetches and stores Codeforces data for a given student.

  This utility function performs the following:
  - Fetches user profile info, contest rating history, and submission history from Codeforces API.
  - Filters only correct submissions ("OK").
  - Saves all relevant data (ratings, solved problems, profile details) into MongoDB.
  - Updates student's last submission date.
 
 This function is triggered:
  - Automatically via cron jobs (daily/weekly/monthly based on settings).
  - Manually when CF handle is updated or from an admin dashboard.

*/

const axios = require('axios');
const CodeforcesData = require('../db/codeforcesData');
const Student = require('../db/student');

const syncCodeforcesData = async (studentId) => {

  // Step 1: Fetch student from DB
  const student = await Student.findById(studentId);
  if (!student) throw new Error('Student not found');

  const handle = student.cfHandle;

  //Step 2: Fetch data from Codeforces API
  const [infoRes, ratingRes, submissionsRes] = await Promise.all([
    axios.get(`https://codeforces.com/api/user.info?handles=${handle}`),
    axios.get(`https://codeforces.com/api/user.rating?handle=${handle}`),
    axios.get(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=10000`)
  ]);

  const userInfo = infoRes.data.result[0];
  const ratingHistory = ratingRes.data.result;
  const submissions = submissionsRes.data.result;

  // Step 3: Extract solved problems only (verdict: "OK")
  const solved = submissions.filter(sub => sub.verdict === 'OK');

  // Step 4: Format submissions for storage
  const formattedSubmissions = solved.map(sub => ({
    id: sub.id,
    contestId: sub.contestId,
    problem: {
      name: sub.problem.name,
      index: sub.problem.index,
      rating: sub.problem.rating,
      tags: sub.problem.tags
    },
    verdict: sub.verdict,
    creationTimeSeconds: sub.creationTimeSeconds
  }));

  // Step 5: Determine latest submission time (for inactivity tracking)
  let latestSubmissionTime = null;
  if (solved.length > 0) {
    latestSubmissionTime = Math.max(...solved.map(sub => sub.creationTimeSeconds));
  }

  // Step 6: Build data object for MongoDB
  const data = {
    student: student._id,
    info: {
      handle: userInfo.handle,
      rating: userInfo.rating,
      maxRating: userInfo.maxRating,
      rank: userInfo.rank,
      maxRank: userInfo.maxRank,
      avatar: userInfo.avatar
    },
    ratingHistory,
    submissions: formattedSubmissions,
    lastSynced: new Date() // mark sync timestamp
  };

  // Step 7: Save Codeforces data to DB (update if exists, else insert)
  await CodeforcesData.findOneAndUpdate(
    { student: student._id },
    data,
    { upsert: true, new: true }
  );

  // Step 8: Update student's lastSubmissionDate (used for inactivity detection)
  if (latestSubmissionTime) {
    student.lastSubmissionDate = new Date(latestSubmissionTime * 1000); // Convert seconds to Date
    await student.save();
  }
};

module.exports = syncCodeforcesData;
