import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, Question, Exam, ExamAssignment, Submission, AuditLog } from '../db.js';
import { getActiveStudents } from '../socket.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'coderank_cbt_secure_secret_token_key_2026';

// Middleware to authenticate admin
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or invalid.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    req.user = { userId: user._id, role: user.role, fullName: user.fullName };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired admin token.' });
  }
};

// GET Dashboard Stats & Charts
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const liveStudents = getActiveStudents().filter(s => s.status === 'active').length;
    
    // Submissions calculations
    const submissions = await Submission.find({}).lean();
    const appearedStudents = submissions.length;
    const passedStudents = submissions.filter(s => s.status === 'pass').length;
    const failedStudents = appearedStudents - passedStudents;

    // Scores math
    let averageScore = 0;
    let averageAccuracy = 0;
    let highestScore = 0;
    let lowestScore = 0;

    if (appearedStudents > 0) {
      const scores = submissions.map(s => s.score);
      const accuracies = submissions.map(s => s.accuracy);
      
      averageScore = Math.round((scores.reduce((a, b) => a + b, 0) / appearedStudents) * 10) / 10;
      averageAccuracy = Math.round((accuracies.reduce((a, b) => a + b, 0) / appearedStudents) * 10) / 10;
      highestScore = Math.max(...scores);
      lowestScore = Math.min(...scores);
    }

    // Chart 1: Pass/Fail Distribution
    const passFailDist = [
      { name: 'Passed', value: passedStudents },
      { name: 'Failed', value: failedStudents }
    ];

    // Chart 2: Score Distribution (Ranges of 5 points)
    const scoreRanges = { '0-5': 0, '6-10': 0, '11-15': 0, '16-20': 0, '21-25': 0, '26-30': 0 };
    submissions.forEach(s => {
      if (s.score <= 5) scoreRanges['0-5']++;
      else if (s.score <= 10) scoreRanges['6-10']++;
      else if (s.score <= 15) scoreRanges['11-15']++;
      else if (s.score <= 20) scoreRanges['16-20']++;
      else if (s.score <= 25) scoreRanges['21-25']++;
      else scoreRanges['26-30']++;
    });
    const scoreDist = Object.entries(scoreRanges).map(([key, val]) => ({ range: key, count: val }));

    // Chart 3: Accuracy Distribution
    const accuracyRanges = { '<50%': 0, '50-70%': 0, '71-90%': 0, '>90%': 0 };
    submissions.forEach(s => {
      if (s.accuracy < 50) accuracyRanges['<50%']++;
      else if (s.accuracy <= 70) accuracyRanges['50-70%']++;
      else if (s.accuracy <= 90) accuracyRanges['71-90%']++;
      else accuracyRanges['>90%']++;
    });
    const accuracyDist = Object.entries(accuracyRanges).map(([key, val]) => ({ range: key, count: val }));

    // Chart 4: Participation (exams created vs active submissions)
    const exams = await Exam.find({}).lean();
    const examParticipation = await Promise.all(exams.map(async (exam) => {
      const count = await Submission.countDocuments({ examId: exam._id });
      return { examTitle: exam.title, participants: count };
    }));

    return res.json({
      cards: {
        totalStudents,
        activeStudents: liveStudents,
        appearedStudents,
        passedStudents,
        failedStudents,
        averageScore,
        averageAccuracy,
        highestScore,
        lowestScore
      },
      charts: {
        passFailDist,
        scoreDist,
        accuracyDist,
        examParticipation
      }
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    return res.status(500).json({ error: 'Failed to retrieve analytics.' });
  }
});

// STUDENT MANAGEMENT CRUD
router.get('/students', authenticateAdmin, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password').sort({ createdAt: -1 });
    return res.json(students);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch students.' });
  }
});

router.post('/students', authenticateAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, rollNumber, year, password } = req.body;
    if (!fullName || !email || !phone || !rollNumber || !year || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const emailCheck = await User.findOne({ email: email.toLowerCase() });
    if (emailCheck) return res.status(400).json({ error: 'Email already exists.' });

    const rollCheck = await User.findOne({ rollNumber });
    if (rollCheck) return res.status(400).json({ error: 'Roll number already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newStudent = new User({
      fullName,
      email: email.toLowerCase(),
      phone,
      rollNumber,
      year,
      password: hashedPassword,
      role: 'student'
    });
    await newStudent.save();

    return res.status(201).json({ message: 'Student created successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create student.' });
  }
});

router.put('/students/:id', authenticateAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, rollNumber, year, password } = req.body;
    const student = await User.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    if (email && email.toLowerCase() !== student.email) {
      const emailCheck = await User.findOne({ email: email.toLowerCase() });
      if (emailCheck) return res.status(400).json({ error: 'Email already exists.' });
      student.email = email.toLowerCase();
    }

    if (rollNumber && rollNumber !== student.rollNumber) {
      const rollCheck = await User.findOne({ rollNumber });
      if (rollCheck) return res.status(400).json({ error: 'Roll number already exists.' });
      student.rollNumber = rollNumber;
    }

    if (fullName) student.fullName = fullName;
    if (phone) student.phone = phone;
    if (year) student.year = year;
    if (password) {
      student.password = await bcrypt.hash(password, 10);
    }

    await student.save();
    return res.json({ message: 'Student updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update student.' });
  }
});

router.delete('/students/:id', authenticateAdmin, async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    // Clean up their assignments and submissions
    await ExamAssignment.deleteMany({ studentId: student._id });
    await Submission.deleteMany({ studentId: student._id });
    await User.findByIdAndDelete(student._id);

    return res.json({ message: 'Student and related records deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete student.' });
  }
});

router.post('/students/import', authenticateAdmin, async (req, res) => {
  try {
    const { students } = req.body; // Array of student objects
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: 'Invalid data format. Expected an array.' });
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    const defaultPasswordHashed = await bcrypt.hash('student123', 10);

    for (const s of students) {
      try {
        const { fullName, email, phone, rollNumber, year } = s;
        if (!fullName || !email || !phone || !rollNumber || !year) {
          errors.push(`Row missing required fields: ${JSON.stringify(s)}`);
          failCount++;
          continue;
        }

        const emailCheck = await User.findOne({ email: email.toLowerCase() });
        const rollCheck = await User.findOne({ rollNumber });

        if (emailCheck || rollCheck) {
          errors.push(`Duplicate email/roll: ${rollNumber} (${email})`);
          failCount++;
          continue;
        }

        await User.create({
          fullName,
          email: email.toLowerCase(),
          phone,
          rollNumber,
          year,
          password: defaultPasswordHashed,
          role: 'student'
        });
        successCount++;
      } catch (e) {
        errors.push(e.message);
        failCount++;
      }
    }

    return res.json({
      message: `Bulk import done. Success: ${successCount}, Failed: ${failCount}`,
      errors
    });
  } catch (err) {
    return res.status(500).json({ error: 'Bulk import failed.' });
  }
});

// QUESTION BANK CRUD
router.get('/questions', authenticateAdmin, async (req, res) => {
  try {
    const questions = await Question.find({}).sort({ createdAt: -1 });
    return res.json(questions);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve question bank.' });
  }
});

router.post('/questions', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, options, correctAnswer, category, difficulty } = req.body;
    if (!title || !options || !correctAnswer || !category || !difficulty) {
      return res.status(400).json({ error: 'Missing required question fields.' });
    }

    const newQuestion = new Question({
      title,
      description,
      options,
      correctAnswer,
      category,
      difficulty
    });
    await newQuestion.save();

    return res.status(201).json({ message: 'Question added successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create question.' });
  }
});

router.put('/questions/:id', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, options, correctAnswer, category, difficulty } = req.body;
    const question = await Question.findByIdAndUpdate(req.params.id, {
      title, description, options, correctAnswer, category, difficulty
    }, { new: true });

    if (!question) return res.status(404).json({ error: 'Question not found.' });
    return res.json({ message: 'Question updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update question.' });
  }
});

// Wipe Question Bank
router.delete('/questions', authenticateAdmin, async (req, res) => {
  try {
    await Question.deleteMany({});
    // Log action
    await AuditLog.create({
      userId: req.user.userId,
      action: 'wipe_question_bank',
      details: 'Wiped the entire Question Bank repository.',
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });
    return res.json({ message: 'Question Bank cleared successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to wipe Question Bank.' });
  }
});

router.delete('/questions/:id', authenticateAdmin, async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found.' });
    return res.json({ message: 'Question deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete question.' });
  }
});

// EXAM MANAGEMENT CRUD
router.get('/exams', authenticateAdmin, async (req, res) => {
  try {
    const exams = await Exam.find({}).sort({ createdAt: -1 });
    return res.json(exams);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load exams.' });
  }
});

router.post('/exams', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, totalQuestions, duration, passingPercentage, startDate, endDate, status } = req.body;
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: 'Title, Start Date, and End Date are required.' });
    }

    const exam = new Exam({
      title,
      description,
      totalQuestions: totalQuestions || 30,
      duration: duration || 60,
      passingPercentage: passingPercentage || 50,
      startDate,
      endDate,
      status: status || 'draft'
    });
    await exam.save();

    return res.status(201).json({ message: 'Exam created successfully.', exam });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create exam.' });
  }
});

router.put('/exams/:id', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, totalQuestions, duration, passingPercentage, startDate, endDate, status } = req.body;
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    if (title) exam.title = title;
    if (description !== undefined) exam.description = description;
    if (totalQuestions) exam.totalQuestions = totalQuestions;
    if (duration) exam.duration = duration;
    if (passingPercentage) exam.passingPercentage = passingPercentage;
    if (startDate) exam.startDate = startDate;
    if (endDate) exam.endDate = endDate;
    if (status) exam.status = status;

    await exam.save();
    return res.json({ message: 'Exam updated successfully.', exam });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update exam.' });
  }
});

router.delete('/exams/:id', authenticateAdmin, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    // Clean up student responses for this exam
    await ExamAssignment.deleteMany({ examId: exam._id });
    await Submission.deleteMany({ examId: exam._id });
    await Exam.findByIdAndDelete(exam._id);

    return res.json({ message: 'Exam deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete exam.' });
  }
});

// LIVE MONITORING
router.get('/live-monitoring', authenticateAdmin, async (req, res) => {
  try {
    const active = getActiveStudents();
    
    // We can also query all assignments that are currently in progress (not submitted) 
    // to build a backup display in case students reconnected or connection is raw database.
    const dbAssignments = await ExamAssignment.find({ isSubmitted: false })
      .populate('studentId', 'fullName rollNumber')
      .populate('examId', 'title')
      .lean();

    const formattedActive = dbAssignments.map(asg => {
      const activeObj = active.find(a => a.studentId === asg.studentId?._id.toString());
      
      const answersObj = asg.answers instanceof Map 
        ? Object.fromEntries(asg.answers) 
        : (asg.answers || {});
      const answersCount = Object.keys(answersObj).length;
      const progress = Math.round((answersCount / 30) * 100);

      return {
        studentId: asg.studentId?._id,
        fullName: asg.studentId?.fullName || 'N/A',
        rollNumber: asg.studentId?.rollNumber || 'N/A',
        examTitle: asg.examId?.title || 'Unknown Exam',
        examId: asg.examId?._id,
        timeRemaining: asg.timeRemaining,
        violationsCount: asg.violationsCount,
        progress,
        status: activeObj ? activeObj.status : 'offline', // active, offline, disconnected
        lastActive: activeObj ? activeObj.lastActive : asg.updatedAt
      };
    });

    return res.json(formattedActive);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve active student logs.' });
  }
});

// RESULTS & AUDIT LOGS
router.get('/results', authenticateAdmin, async (req, res) => {
  try {
    const results = await Submission.find({})
      .populate('studentId', 'fullName rollNumber email phone year')
      .populate('examId', 'title')
      .sort({ submittedAt: -1 })
      .lean();

    const formatted = results.map((r, idx) => ({
      id: r._id,
      studentId: r.studentId?._id || 'N/A',
      examId: r.examId?._id || 'N/A',
      studentName: r.studentId?.fullName || 'N/A',
      rollNumber: r.studentId?.rollNumber || 'N/A',
      email: r.studentId?.email || 'N/A',
      phone: r.studentId?.phone || 'N/A',
      academicYear: r.studentId?.year || 'N/A',
      examTitle: r.examId?.title || 'N/A',
      score: r.score,
      accuracy: r.accuracy,
      totalCorrect: r.totalCorrect,
      totalWrong: r.totalWrong,
      totalUnanswered: r.totalUnanswered,
      submittedAt: r.submittedAt,
      submissionTimeSeconds: r.submissionTimeSeconds,
      status: r.status
    }));

    return res.json(formatted);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch examination results.' });
  }
});

router.post('/results', authenticateAdmin, async (req, res) => {
  try {
    const { studentId, examId, score, accuracy, totalCorrect, totalWrong, totalUnanswered, status, submissionTimeSeconds, submittedAt } = req.body;
    if (!studentId || !examId || score === undefined || accuracy === undefined || status === undefined || submissionTimeSeconds === undefined) {
      return res.status(400).json({ error: 'Missing required result fields.' });
    }

    // Check duplicate
    const duplicate = await Submission.findOne({ studentId, examId });
    if (duplicate) {
      return res.status(400).json({ error: 'A submission result already exists for this student and exam.' });
    }

    const submission = new Submission({
      studentId,
      examId,
      score,
      accuracy,
      totalCorrect: totalCorrect || 0,
      totalWrong: totalWrong || 0,
      totalUnanswered: totalUnanswered || 0,
      submittedAt: submittedAt || new Date(),
      status,
      submissionTimeSeconds
    });
    await submission.save();

    // Log action
    await AuditLog.create({
      userId: req.user.userId,
      action: 'create_result',
      details: `Manually created result for Student ID: ${studentId}, Exam ID: ${examId}, Score: ${score}`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    return res.status(201).json({ message: 'Exam result created successfully.', submission });
  } catch (err) {
    console.error('Error creating exam result:', err);
    return res.status(500).json({ error: 'Failed to create exam result.' });
  }
});

router.put('/results/:id', authenticateAdmin, async (req, res) => {
  try {
    const { score, accuracy, totalCorrect, totalWrong, totalUnanswered, status, submissionTimeSeconds, submittedAt } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Exam result not found.' });

    if (score !== undefined) submission.score = score;
    if (accuracy !== undefined) submission.accuracy = accuracy;
    if (totalCorrect !== undefined) submission.totalCorrect = totalCorrect;
    if (totalWrong !== undefined) submission.totalWrong = totalWrong;
    if (totalUnanswered !== undefined) submission.totalUnanswered = totalUnanswered;
    if (status !== undefined) submission.status = status;
    if (submissionTimeSeconds !== undefined) submission.submissionTimeSeconds = submissionTimeSeconds;
    if (submittedAt !== undefined) submission.submittedAt = submittedAt;

    await submission.save();

    // Log action
    await AuditLog.create({
      userId: req.user.userId,
      action: 'update_result',
      details: `Updated result ID: ${submission._id}. Score: ${submission.score}, Status: ${submission.status}`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    return res.json({ message: 'Exam result updated successfully.', submission });
  } catch (err) {
    console.error('Error updating exam result:', err);
    return res.status(500).json({ error: 'Failed to update exam result.' });
  }
});

router.delete('/results/:id', authenticateAdmin, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Exam result not found.' });

    await Submission.findByIdAndDelete(submission._id);

    // Log action
    await AuditLog.create({
      userId: req.user.userId,
      action: 'delete_result',
      details: `Deleted exam result ID: ${submission._id} for student ID: ${submission.studentId}, exam ID: ${submission.examId}`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    return res.json({ message: 'Exam result deleted successfully.' });
  } catch (err) {
    console.error('Error deleting exam result:', err);
    return res.status(500).json({ error: 'Failed to delete exam result.' });
  }
});

router.get('/audit-logs', authenticateAdmin, async (req, res) => {
  try {
    const logs = await AuditLog.find({})
      .populate('userId', 'fullName rollNumber role')
      .sort({ timestamp: -1 })
      .limit(1000)
      .lean();

    const formatted = logs.map(l => ({
      id: l._id,
      userName: l.userId?.fullName || 'Guest / System',
      rollNumber: l.userId?.rollNumber || 'N/A',
      role: l.userId?.role || 'N/A',
      action: l.action,
      details: l.details,
      ipAddress: l.ipAddress,
      timestamp: l.timestamp
    }));

    return res.json(formatted);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve audit trail logs.' });
  }
});

export default router;
