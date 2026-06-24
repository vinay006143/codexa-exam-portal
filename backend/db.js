import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/coderank';

mongoose.connect(mongoUri)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => {
    console.error('Error connecting to MongoDB:', err.message);
    console.log('Ensure your MongoDB instance is running locally or check MONGODB_URI in backend/.env.');
  });

// User Schema
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String, required: true },
  rollNumber: { type: String, unique: true, sparse: true, index: true },
  year: { type: String },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' }
}, { timestamps: true });

// Question Schema
const questionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  options: { type: [String], required: true },
  correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  category: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true }
}, { timestamps: true });

// Exam Schema
const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  totalQuestions: { type: Number, default: 30 },
  duration: { type: Number, default: 60 }, // in minutes
  passingPercentage: { type: Number, default: 50 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'scheduled', 'active', 'completed'], default: 'draft' }
}, { timestamps: true });

// ExamAssignment Schema
const examAssignmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  assignedQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  answers: { type: Map, of: String, default: {} },
  questionStates: { type: Map, of: String, default: {} },
  timeRemaining: { type: Number, required: true },
  startedAt: { type: Date, default: Date.now },
  isSubmitted: { type: Boolean, default: false },
  violationsCount: { type: Number, default: 0 }
}, { timestamps: true });

examAssignmentSchema.index({ studentId: 1, examId: 1 }, { unique: true });

// Submission Schema
const submissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  score: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  totalCorrect: { type: Number, default: 0 },
  totalWrong: { type: Number, default: 0 },
  totalUnanswered: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pass', 'fail'], required: true },
  submissionTimeSeconds: { type: Number, required: true }
}, { timestamps: true });

submissionSchema.index({ studentId: 1, examId: 1 }, { unique: true });

// AuditLog Schema
const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true },
  details: { type: String },
  ipAddress: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Question = mongoose.model('Question', questionSchema);
export const Exam = mongoose.model('Exam', examSchema);
export const ExamAssignment = mongoose.model('ExamAssignment', examAssignmentSchema);
export const Submission = mongoose.model('Submission', submissionSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
