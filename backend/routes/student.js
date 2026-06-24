import express from 'express';
import jwt from 'jsonwebtoken';
import { User, Question, Exam, ExamAssignment, Submission, AuditLog } from '../db.js';
import { broadcastEvent } from '../socket.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'coderank_cbt_secure_secret_token_key_2026';

// Middleware to authenticate student
const authenticateStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or invalid.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User does not exist.' });
    }
    
    req.user = { userId: user._id, role: user.role, fullName: user.fullName, rollNumber: user.rollNumber };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

// Fetch available exams for the student
router.get('/exams', authenticateStudent, async (req, res) => {
  try {
    const exams = await Exam.find({ status: { $ne: 'draft' } }).lean();
    
    // Check submission status for each exam
    const submissions = await Submission.find({ studentId: req.user.userId }).lean();
    const submissionMap = new Map(submissions.map(s => [s.examId.toString(), s]));
    
    const assignments = await ExamAssignment.find({ studentId: req.user.userId }).lean();
    const assignmentMap = new Map(assignments.map(a => [a.examId.toString(), a]));

    const processedExams = exams.map(exam => {
      const examIdStr = exam._id.toString();
      const submission = submissionMap.get(examIdStr);
      const assignment = assignmentMap.get(examIdStr);
      
      let studentStatus = 'available'; // available, ongoing, completed
      if (submission) {
        studentStatus = 'completed';
      } else if (assignment && !assignment.isSubmitted) {
        studentStatus = 'ongoing';
      }

      return {
        ...exam,
        studentStatus,
        submission: submission ? {
          score: submission.score,
          accuracy: submission.accuracy,
          status: submission.status,
          submittedAt: submission.submittedAt
        } : null
      };
    });

    return res.json(processedExams);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch exams.' });
  }
});

// Fetch detailed pre-exam rules (does not leak questions)
router.get('/exams/:examId', authenticateStudent, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId).lean();
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    // Check if already submitted
    const submission = await Submission.findOne({ studentId: req.user.userId, examId: exam._id });
    if (submission) {
      return res.json({ exam, status: 'completed', submission });
    }

    const assignment = await ExamAssignment.findOne({ studentId: req.user.userId, examId: exam._id });
    return res.json({
      exam,
      status: assignment ? (assignment.isSubmitted ? 'completed' : 'ongoing') : 'available',
      timeRemaining: assignment ? assignment.timeRemaining : exam.duration * 60
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error retrieving exam specifications.' });
  }
});

// Start / Resume Exam (Assignment setup)
router.post('/exams/:examId/start', authenticateStudent, async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.userId;

    const exam = await Exam.findById(examId);
    if (!exam || exam.status !== 'active') {
      return res.status(400).json({ error: 'This exam is not active or available.' });
    }

    // Check existing submission
    const existingSubmission = await Submission.findOne({ studentId, examId });
    if (existingSubmission) {
      return res.status(400).json({ error: 'You have already submitted this exam.' });
    }

    // Check if assignment exists (Resume flow)
    let assignment = await ExamAssignment.findOne({ studentId, examId }).populate('assignedQuestions');
    if (assignment) {
      if (assignment.isSubmitted) {
        return res.status(400).json({ error: 'Your exam assignment has already been finalized.' });
      }
      return res.json({
        message: 'Resuming ongoing exam session.',
        assignmentId: assignment._id,
        timeRemaining: assignment.timeRemaining,
        questionsCount: assignment.assignedQuestions.length
      });
    }

    // New Exam Start flow: Lock and shuffle 30 questions
    const questionPool = await Question.find({});
    if (questionPool.length < 30) {
      return res.status(500).json({ error: 'Insufficient questions in question bank to start exam. Minimum required is 30.' });
    }

    // Shuffle questions
    const shuffled = [...questionPool].sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, 30);

    // Save assignment
    assignment = new ExamAssignment({
      studentId,
      examId,
      assignedQuestions: selectedQuestions.map(q => q._id),
      timeRemaining: exam.duration * 60,
      answers: {},
      questionStates: {},
      startedAt: new Date(),
      isSubmitted: false,
      violationsCount: 0
    });
    
    // Set all question states to not_visited initially
    selectedQuestions.forEach(q => {
      assignment.questionStates.set(q._id.toString(), 'not_visited');
    });

    await assignment.save();

    // Log action
    await AuditLog.create({
      userId: studentId,
      action: 'exam_start',
      details: `Started exam: "${exam.title}"`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    // Notify admins via socket
    broadcastEvent('student_status_change', {
      studentId,
      fullName: req.user.fullName,
      rollNumber: req.user.rollNumber,
      examId,
      lastActive: new Date(),
      violationsCount: 0,
      progress: 0,
      status: 'active'
    });

    return res.json({
      message: 'Exam initialized successfully.',
      assignmentId: assignment._id,
      timeRemaining: assignment.timeRemaining,
      questionsCount: 30
    });
  } catch (err) {
    console.error('Error starting exam:', err);
    return res.status(500).json({ error: 'Failed to initialize exam session.' });
  }
});

// Fetch assigned questions (excluding answers to avoid hacking)
router.get('/exams/:examId/questions', authenticateStudent, async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.userId;

    const assignment = await ExamAssignment.findOne({ studentId, examId }).populate('assignedQuestions');
    if (!assignment) {
      return res.status(404).json({ error: 'No active exam assignment found. Please start the exam first.' });
    }

    if (assignment.isSubmitted) {
      return res.status(403).json({ error: 'This exam assignment has already been submitted.' });
    }

    // Prepare questions without leaking correctAnswer
    const questionsSecure = assignment.assignedQuestions.map((q) => {
      return {
        id: q._id,
        title: q.title,
        description: q.description,
        options: q.options, // Already preloaded in seed
        category: q.category,
        difficulty: q.difficulty
      };
    });

    // Calculate initial progress: answered / 30
    const answersObj = Object.fromEntries(assignment.answers || new Map());
    const statesObj = Object.fromEntries(assignment.questionStates || new Map());
    const answeredCount = Object.keys(answersObj).length;
    const progress = Math.round((answeredCount / 30) * 100);

    return res.json({
      questions: questionsSecure,
      answers: answersObj,
      questionStates: statesObj,
      timeRemaining: assignment.timeRemaining,
      violationsCount: assignment.violationsCount,
      progress
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch exam questions.' });
  }
});

// Autosave answers, question states, timeRemaining, and security violations
router.post('/exams/:examId/autosave', authenticateStudent, async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.userId;
    const { answers, questionStates, timeRemaining, violationsCount } = req.body;

    const assignment = await ExamAssignment.findOne({ studentId, examId });
    if (!assignment) {
      return res.status(404).json({ error: 'Exam assignment not found.' });
    }

    if (assignment.isSubmitted) {
      return res.status(400).json({ error: 'Cannot save details; exam is already submitted.' });
    }

    // Save states
    if (answers) assignment.answers = answers;
    if (questionStates) assignment.questionStates = questionStates;
    if (timeRemaining !== undefined) assignment.timeRemaining = timeRemaining;
    if (violationsCount !== undefined) {
      // Check if violations changed and write an audit log
      if (violationsCount > assignment.violationsCount) {
        await AuditLog.create({
          userId: studentId,
          action: 'security_violation',
          details: `Security rule violation logged. New count: ${violationsCount}`,
          ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
        });
      }
      assignment.violationsCount = violationsCount;
    }

    await assignment.save();

    // Broadcast update via Socket.io
    const progress = Math.round((Object.keys(answers || {}).length / 30) * 100);
    broadcastEvent('student_status_change', {
      studentId,
      fullName: req.user.fullName,
      rollNumber: req.user.rollNumber,
      examId,
      lastActive: new Date(),
      violationsCount: assignment.violationsCount,
      progress,
      status: 'active'
    });

    return res.json({ message: 'Progress saved successfully.', timeRemaining: assignment.timeRemaining });
  } catch (err) {
    console.error('Error during auto-save:', err);
    return res.status(500).json({ error: 'Autosave failure.' });
  }
});

// Submit / Evaluate Exam
router.post('/exams/:examId/submit', authenticateStudent, async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.userId;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ error: 'Exam specification not found.' });
    }

    // Check duplicate submission
    const duplicate = await Submission.findOne({ studentId, examId });
    if (duplicate) {
      return res.status(400).json({ error: 'You have already submitted this exam.' });
    }

    const assignment = await ExamAssignment.findOne({ studentId, examId }).populate('assignedQuestions');
    if (!assignment) {
      return res.status(404).json({ error: 'No assignment found to submit.' });
    }

    // Check if submission is manual and early (not within last 5 minutes)
    const isTimeSubmitActive = assignment.timeRemaining <= 300 || (exam.duration && exam.duration * 60 <= 300);
    const isAuto = req.body && req.body.isAuto;
    const excessiveViolations = assignment.violationsCount >= 3;

    if (!isTimeSubmitActive && !isAuto && !excessiveViolations) {
      return res.status(400).json({ error: 'Manual exam submission is only allowed during the final 5 minutes.' });
    }

    const assignedQuestions = assignment.assignedQuestions;
    const studentAnswers = Object.fromEntries(assignment.answers || new Map());

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    assignedQuestions.forEach(question => {
      const qId = question._id.toString();
      const studentAns = studentAnswers[qId];

      if (!studentAns) {
        unansweredCount++;
      } else if (studentAns === question.correctAnswer) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    const totalQuestions = assignedQuestions.length || 30;
    const score = correctCount; // 1 mark per correct answer
    const accuracy = Math.round((correctCount / totalQuestions) * 100);
    const passOrFail = accuracy >= exam.passingPercentage ? 'pass' : 'fail';
    
    // Time taken calculation
    const timeSpentSeconds = (exam.duration * 60) - assignment.timeRemaining;

    // Create Submission
    const submission = new Submission({
      studentId,
      examId,
      score,
      accuracy,
      totalCorrect: correctCount,
      totalWrong: wrongCount,
      totalUnanswered: unansweredCount,
      submittedAt: new Date(),
      status: passOrFail,
      submissionTimeSeconds: timeSpentSeconds > 0 ? timeSpentSeconds : exam.duration * 60
    });
    await submission.save();

    // Update assignment to submitted
    assignment.isSubmitted = true;
    await assignment.save();

    // Log action
    await AuditLog.create({
      userId: studentId,
      action: 'exam_submit',
      details: `Submitted exam "${exam.title}". Score: ${score}/30. Pass status: ${passOrFail}`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    // Notify admins
    broadcastEvent('student_status_change', {
      studentId,
      fullName: req.user.fullName,
      rollNumber: req.user.rollNumber,
      examId,
      lastActive: new Date(),
      violationsCount: assignment.violationsCount,
      progress: 100,
      status: 'completed'
    });

    // Broadcast new submission to alert admins
    broadcastEvent('new_submission_received', {
      studentName: req.user.fullName,
      rollNumber: req.user.rollNumber,
      examName: exam.title,
      score,
      status: passOrFail
    });

    return res.json({
      message: 'Exam submitted and evaluated successfully.',
      submission: {
        score,
        accuracy,
        totalCorrect: correctCount,
        totalWrong: wrongCount,
        totalUnanswered: unansweredCount,
        status: passOrFail,
        submittedAt: submission.submittedAt
      }
    });
  } catch (err) {
    console.error('Error submitting exam:', err);
    return res.status(500).json({ error: 'Failed to submit and evaluate your exam.' });
  }
});

// Fetch Leaderboard for an Exam
router.get('/leaderboard/:examId', authenticateStudent, async (req, res) => {
  try {
    const { examId } = req.params;
    const submissions = await Submission.find({ examId })
      .populate('studentId', 'fullName rollNumber')
      .lean();

    // Sort: 1) Score DESC, 2) Accuracy DESC, 3) SubmissionTimeSeconds ASC
    const sorted = submissions.map((sub, idx) => ({
      studentName: sub.studentId?.fullName || 'Unknown Student',
      rollNumber: sub.studentId?.rollNumber || 'N/A',
      score: sub.score,
      accuracy: sub.accuracy,
      submissionTimeSeconds: sub.submissionTimeSeconds,
      submittedAt: sub.submittedAt
    })).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return a.submissionTimeSeconds - b.submissionTimeSeconds;
    });

    // Inject rankings
    const ranked = sorted.map((item, idx) => ({
      rank: idx + 1,
      ...item
    }));

    return res.json(ranked);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load exam leaderboard.' });
  }
});

export default router;
