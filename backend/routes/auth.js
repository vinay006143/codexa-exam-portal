import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AuditLog } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'coderank_cbt_secure_secret_token_key_2026';

// Midleware to parse IP
const getIp = (req) => {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
};

// Student Registration
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, rollNumber, year, password } = req.body;

    // Field presence checks
    if (!fullName || !email || !phone || !rollNumber || !year || !password) {
      return res.status(400).json({ error: 'All registration fields are required.' });
    }

    // Check unique email
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email address is already registered.' });
    }

    // Check unique roll number
    const existingRoll = await User.findOne({ rollNumber: rollNumber.trim() });
    if (existingRoll) {
      return res.status(400).json({ error: 'Roll Number is already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save student
    const student = new User({
      fullName,
      email: email.toLowerCase(),
      phone,
      rollNumber: rollNumber.trim(),
      year,
      password: hashedPassword,
      role: 'student'
    });
    await student.save();

    // Log action
    await AuditLog.create({
      userId: student._id,
      action: 'register',
      details: `Student account created for roll number: ${rollNumber}`,
      ipAddress: getIp(req)
    });

    return res.status(201).json({ message: 'Registration successful! You can now log in.' });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Admin & Student Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Fetch user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email credentials.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    // Sign JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Log action
    await AuditLog.create({
      userId: user._id,
      action: 'login',
      details: `${user.role} logged in successfully.`,
      ipAddress: getIp(req)
    });

    return res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        rollNumber: user.rollNumber,
        phone: user.phone,
        year: user.year
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Forgot Password Mock (Generates a 6-digit code printed to logs)
const resetCodes = new Map(); // email -> resetCode

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'No user registered with this email.' });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes.set(email.toLowerCase(), code);

    // Print to logs for mock testing
    console.log(`[PASS_RESET_MOCK] Code for ${email}: ${code}`);

    return res.json({
      message: 'Password reset code has been sent (mock). Please check server console logs for the code.',
      mockCode: code // sent back directly for ease of local testing without checking terminal logs!
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error during forgot password.' });
  }
});

// Reset Password Confirm
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required.' });
    }

    const savedCode = resetCodes.get(email.toLowerCase());
    if (!savedCode || savedCode !== code) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    resetCodes.delete(email.toLowerCase());

    await AuditLog.create({
      userId: user._id,
      action: 'reset_password',
      details: 'Password was reset successfully.',
      ipAddress: getIp(req)
    });

    return res.json({ message: 'Password has been reset successfully! You can now log in.' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error during password reset.' });
  }
});

export default router;
