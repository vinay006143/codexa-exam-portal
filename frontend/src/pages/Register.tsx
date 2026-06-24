import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Phone, BookOpen, KeyRound, Calendar, ShieldCheck, Activity, Terminal, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [year, setYear] = useState('First Year');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Field Validations
    if (!fullName || !email || !phone || !rollNumber || !year || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          rollNumber,
          year,
          password
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative overflow-hidden">
      {/* Background Decorative Glow Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none animate-pulse-glow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse-glow" style={{ animationDelay: '1.5s' }}></div>

      {/* Left side: Premium Branding & Features */}
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
              Register your Candidate Account.
            </h1>
            <p className="text-slate-655 text-sm leading-relaxed">
              Create an official profile to assign schedules, take examinations, review real-time feedback, and secure evaluations.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm transition-all duration-300 hover:border-slate-300">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-slate-900 font-semibold text-sm">Automated Schedule Delivery</h4>
                <p className="text-slate-500 text-xs mt-1">Get immediate workspace assignments from administrators as soon as your account registers.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm transition-all duration-300 hover:border-slate-300">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-slate-900 font-semibold text-sm">Secure Evaluation Logs</h4>
                <p className="text-slate-500 text-xs mt-1">Full database mapping holds submission details, correct counts, wrong counts, and detailed timing reports.</p>
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

      {/* Right side: Register Form Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
        
        {/* Mobile Header Branding */}
        <div className="lg:hidden text-center mb-8">
          <div className="flex justify-center items-center gap-2 mb-1">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <span className="text-slate-900 text-2xl font-extrabold tracking-wider">CODERANK</span>
            <span className="text-blue-600 font-extrabold text-xl">CBT PRO</span>
          </div>
          <p className="text-slate-550 text-xs">Student Registration Portal</p>
        </div>

        <div className="w-full max-w-md animate-fade-in-up">
          <div className="glass-panel py-7 px-6 sm:px-8 rounded-2xl border border-slate-200/80 shadow-2xl relative overflow-hidden bg-white/90">
            
            {/* Header divider subtle glow */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60"></div>
            
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold text-slate-950 tracking-tight flex items-center justify-center gap-2">
                  <User className="h-5 w-5 text-blue-600 shrink-0" /> Student Registration
                </h2>
                <p className="text-xs text-slate-500 font-medium">Create your credentials to launch tests</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-xl">
                  {success}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xxs font-bold text-slate-700 uppercase tracking-wider">Full Name</label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition duration-150"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xxs font-bold text-slate-700 uppercase tracking-wider">Email Address</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition duration-150"
                      placeholder="name@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xxs font-bold text-slate-700 uppercase tracking-wider">Phone Number</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-455 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition duration-150"
                      placeholder="10-digit number"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xxs font-bold text-slate-700 uppercase tracking-wider">Roll Number</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <BookOpen className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-455 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition duration-150"
                      placeholder="e.g. CS202611"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xxs font-bold text-slate-700 uppercase tracking-wider">Academic Year</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-4 w-4 text-slate-400" />
                    </div>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-805 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition duration-150"
                    >
                      <option>First Year</option>
                      <option>Second Year</option>
                      <option>Third Year</option>
                      <option>Final Year</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xxs font-bold text-slate-700 uppercase tracking-wider">Password</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <KeyRound className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-455 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition duration-150"
                      placeholder="Min 6 chars"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xxs font-bold text-slate-700 uppercase tracking-wider">Confirm Password</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <KeyRound className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-455 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition duration-150"
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Link to="/login" className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition">
                  Already registered? Sign In
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-semibold glow-button-primary disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating Account...</span>
                  </div>
                ) : 'Register Candidate Profile'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
