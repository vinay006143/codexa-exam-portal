import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, ShieldAlert, Award, Lock, BookOpen, ShieldCheck, Activity, Terminal, Sparkles, Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [loginRole, setLoginRole] = useState<'student' | 'admin'>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Forgot Password States
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: Code & Pass
  const [forgotMsg, setForgotMsg] = useState('');
  const [mockCodeTip, setMockCodeTip] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      if (data.user.role !== loginRole) {
        throw new Error(`Access denied. Registered as a ${data.user.role.toUpperCase()}. Please use the correct tab.`);
      }

      login(data);
      if (data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Server error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setForgotMsg('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit reset request.');
      }

      setForgotMsg(data.message);
      if (data.mockCode) {
        setMockCodeTip(data.mockCode); // Pass back mock code for easy testing
      }
      setForgotStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setForgotMsg('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, code: resetCode, newPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setForgotMsg(data.message);
      setTimeout(() => {
        setShowForgot(false);
        setForgotStep(1);
        setForgotEmail('');
        setResetCode('');
        setNewPassword('');
        setMockCodeTip('');
        setForgotMsg('');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative overflow-hidden">
      {/* Background Decorative Glow Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none animate-pulse-glow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse-glow" style={{ animationDelay: '1.5s' }}></div>

      {/* Left side: Premium Branding & Features (Visible on large screens) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-100/40 p-16 flex-col justify-between border-r border-slate-200 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-50"></div>
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-12 w-12 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-500/20 shadow-sm">
            <BookOpen className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <span className="text-slate-900 text-2xl font-extrabold tracking-wider font-sans">CODERANK</span>
            <span className="text-blue-600 font-extrabold text-xl ml-1">CBT PRO</span>
            <span className="text-xxs block text-slate-500 font-bold uppercase tracking-widest mt-0.5">Examination Engine</span>
          </div>
        </div>

        {/* Feature Cards Showcase */}
        <div className="space-y-8 my-auto relative z-10 max-w-lg">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-700 text-xs font-semibold">
              <Sparkles className="h-3 w-3 text-blue-600" />
              <span>Next-Gen CBT Console</span>
            </div>
            <h1 className="text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
              The standard for high-fidelity evaluation.
            </h1>
            <p className="text-slate-655 text-sm leading-relaxed">
              Designed with reliability, security, and exceptional user experience as primary pillars. Connect, execute tests, and evaluate scores in real time.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm transition-all duration-300 hover:border-slate-300">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-slate-900 font-semibold text-sm">Active AI Proctoring</h4>
                <p className="text-slate-500 text-xs mt-1">Advanced browser security detection, full focus tracking, and automated audit trails to ensure compliance.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm transition-all duration-300 hover:border-slate-300">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-slate-900 font-semibold text-sm">Real-time Progress Sync</h4>
                <p className="text-slate-500 text-xs mt-1">Multi-channel socket channels push states continuously so that no session detail or timing logs are ever lost.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm transition-all duration-300 hover:border-slate-300">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Terminal className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h4 className="text-slate-900 font-semibold text-sm">Developer Friendly Exam Engine</h4>
                <p className="text-slate-500 text-xs mt-1">Rich code styling, multiple difficulty classifications, and robust tabular rankings for immediate insight.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-slate-400 text-xs flex justify-between items-center relative z-10">
          <span>© 2026 CodeRank CBT Inc.</span>
          <div className="flex gap-3">
            <a href="#" className="hover:text-slate-600 transition">Terms</a>
            <a href="#" className="hover:text-slate-600 transition">Security</a>
          </div>
        </div>
      </div>

      {/* Right side: Login Interactive Form Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
        
        {/* Mobile Header Branding */}
        <div className="lg:hidden text-center mb-8">
          <div className="flex justify-center items-center gap-2 mb-1">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <span className="text-slate-900 text-2xl font-extrabold tracking-wider">CODERANK</span>
            <span className="text-blue-600 font-extrabold text-xl">CBT PRO</span>
          </div>
          <p className="text-slate-500 text-xs">Professional Testing System Console</p>
        </div>

        <div className="w-full max-w-md animate-fade-in-up">
          <div className="glass-panel py-8 px-6 sm:px-10 rounded-2xl border border-slate-200/80 shadow-2xl relative overflow-hidden bg-white/90">
            
            {/* Header divider subtle glow */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60"></div>
            
            {!showForgot ? (              <form className="space-y-5" onSubmit={handleLogin}>
                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-bold text-slate-950 tracking-tight flex items-center justify-center gap-2">
                    <Lock className="h-5 w-5 text-blue-600 shrink-0" /> Portal Sign In
                  </h2>
                  <p className="text-xs text-slate-500">Provide your authorization credentials</p>
                </div>

                {/* Role Switch Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole('student');
                      setError('');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      loginRole === 'student'
                        ? 'bg-white text-blue-650 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Student Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole('admin');
                      setError('');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      loginRole === 'admin'
                        ? 'bg-white text-blue-650 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Admin Login
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-650" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Email Address</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-200 text-sm"
                      placeholder={loginRole === 'admin' ? 'e.g. admin@coderank.com' : 'e.g. student@coderank.com'}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setError(''); }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <KeyRound className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-200 text-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer font-bold text-xs"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-semibold glow-button-primary disabled:opacity-50 transition duration-250 cursor-pointer"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Verifying...</span>
                      </div>
                    ) : 'Secure Sign In'}
                  </button>
                </div>

                <div className="flex justify-center items-center pt-2">
                  <p className="text-xs text-slate-500">
                    Need a student account?{' '}
                    <Link to="/register" className="text-blue-600 hover:text-blue-700 font-bold transition">
                      Create Account
                    </Link>
                  </p>
                </div>

                <div className="p-3.5 bg-slate-55 rounded-xl border border-slate-200 text-slate-600 text-xxs leading-5">
                  <p className="font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Award className="h-3 w-3 text-yellow-600" /> Quick Credentials Hub
                  </p>
                  <ul className="space-y-1">
                    <li className="flex justify-between border-b border-slate-200 pb-1">
                      <span>Admin Access:</span>
                      <strong className="text-slate-800">admin@coderank.com / adminPassword123</strong>
                    </li>
                    <li className="flex justify-between pt-1">
                      <span>Student Access:</span>
                      <strong className="text-slate-800">alice@student.com / student123</strong>
                    </li>
                  </ul>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Reset Password</h2>
                  <p className="text-xs text-slate-550">Secure recovery sequence</p>
                </div>
                
                {error && (
                  <div className="bg-red-55 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-650" />
                    <span>{error}</span>
                  </div>
                )}
                {forgotMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl">
                    {forgotMsg}
                  </div>
                )}

                {forgotStep === 1 ? (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-750 uppercase tracking-wider">Account Email Address</label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-205 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                        placeholder="Enter registered email address"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowForgot(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 transition font-medium py-2"
                      >
                        Cancel & Return
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex justify-center items-center py-2 px-5 rounded-xl text-xs font-semibold glow-button-primary disabled:opacity-50"
                      >
                        {loading ? 'Submitting...' : 'Send Recovery OTP'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    {mockCodeTip && (
                      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xxs p-3 rounded-xl flex items-center justify-between gap-2 leading-relaxed">
                        <span>OTP intercepted successfully:</span>
                        <strong className="text-yellow-700 text-sm font-mono tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{mockCodeTip}</strong>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-750 uppercase tracking-wider">Verification OTP Code</label>
                      <input
                        type="text"
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-205 rounded-xl text-slate-800 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                        placeholder="Enter 6-digit code"
                      />
                    </div>
                     <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-755 uppercase tracking-wider">New Password</label>
                      <div className="relative rounded-lg shadow-sm">
                        <input
                          type={showResetPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="block w-full px-3.5 pr-10 py-2.5 bg-slate-55 border border-slate-205 rounded-xl text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                          placeholder="Min 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetPassword(!showResetPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer font-bold text-xs"
                        >
                          {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => setForgotStep(1)}
                        className="text-xs text-slate-500 hover:text-slate-800 transition font-medium py-2"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex justify-center items-center py-2 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md disabled:opacity-50"
                      >
                        {loading ? 'Processing...' : 'Complete Reset'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
