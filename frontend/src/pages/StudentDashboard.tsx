import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Calendar, CheckCircle2, User, Trophy, LogOut, RefreshCw, AlertCircle, FileSpreadsheet, Lock } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'exams' | 'results' | 'leaderboard' | 'profile'>('overview');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selected Exam for Leaderboard
  const [selectedLeaderboardExam, setSelectedLeaderboardExam] = useState<string>('');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Profile update fields
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [year, setYear] = useState(user?.year || 'First Year');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  const fetchExams = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/student/exams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load exams.');
      const data = await res.json();
      setExams(data);

      // Auto select the first active/completed exam for the leaderboard
      if (data.length > 0 && !selectedLeaderboardExam) {
        setSelectedLeaderboardExam(data[0]._id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (examId: string) => {
    if (!examId) return;
    setLeaderboardLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/student/leaderboard/${examId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Could not load leaderboard.');
      const data = await res.json();
      setLeaderboardData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [token]);

  useEffect(() => {
    if (selectedLeaderboardExam) {
      fetchLeaderboard(selectedLeaderboardExam);
    }
  }, [selectedLeaderboardExam]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileError('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/students/${user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName,
          phone,
          year,
          ...(newPassword ? { password: newPassword } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

      setProfileMsg('Profile updated successfully! (Changes will apply fully on your next login).');
      setNewPassword('');
    } catch (err: any) {
      setProfileError(err.message);
    }
  };

  // Filter exams by categories
  const activeExams = exams.filter(e => e.studentStatus === 'ongoing' || (e.status === 'active' && e.studentStatus === 'available'));
  const upcomingExams = exams.filter(e => e.status === 'scheduled');
  const completedExams = exams.filter(e => e.studentStatus === 'completed' || e.status === 'completed');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <span className="text-slate-900 text-lg font-extrabold tracking-wider">CODERANK</span>
              <span className="text-blue-600 font-extrabold text-lg ml-0.5">CBT</span>
              <span className="text-xxs block text-slate-500 font-medium tracking-wide">Computer Based Testing Console</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="font-bold text-sm text-slate-900">{user?.fullName}</p>
              <p className="text-xxs text-slate-500 font-semibold uppercase tracking-wider">Roll No: {user?.rollNumber} • {user?.year}</p>
            </div>
            
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 text-xs font-semibold transition duration-150 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-6">
        
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition text-left cursor-pointer border ${
              activeTab === 'overview' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/15' 
                : 'bg-white text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-slate-200'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Overview</span>
          </button>
          
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition text-left cursor-pointer border ${
              activeTab === 'exams' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/15' 
                : 'bg-white text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4" />
              <span>CBT Schedules</span>
            </div>
            {activeExams.length > 0 && (
              <span className="bg-red-500 text-white text-xxs font-bold px-2 py-0.5 rounded-full">{activeExams.length}</span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition text-left cursor-pointer border ${
              activeTab === 'results' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/15' 
                : 'bg-white text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-slate-200'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Evaluations</span>
          </button>
          
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition text-left cursor-pointer border ${
              activeTab === 'leaderboard' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/15' 
                : 'bg-white text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-slate-200'
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>Portal Rankings</span>
          </button>
          
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition text-left cursor-pointer border ${
              activeTab === 'profile' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/15' 
                : 'bg-white text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-slate-200'
            }`}
          >
            <User className="h-4 w-4" />
            <span>My Profile</span>
          </button>
          
          <button
            onClick={fetchExams}
            className="mt-6 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-semibold transition duration-150 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Synchronize Data
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[480px]">
          {error && (
            <div className="bg-red-50 text-red-750 p-4 rounded-xl mb-6 flex items-center gap-3 border border-red-200 animate-fade-in-up">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-550" />
              <span className="text-xs font-semibold">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-24 gap-3 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-xs font-bold text-slate-550">Pulling workspace configurations...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">Welcome, {user?.fullName}!</h2>
                      <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase mt-1">Role: CBT Student Candidate • Status: Active</p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-250 text-emerald-700 text-xs font-bold self-start">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>Portal Synchronized</span>
                    </div>
                  </div>

                  {/* High Contrast Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Calendar className="h-16 w-16 text-blue-600" />
                      </div>
                      <p className="text-xxs text-blue-755 font-bold uppercase tracking-widest">Active Examinations</p>
                      <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{activeExams.length}</h3>
                      <p className="text-xxs text-slate-500 font-medium mt-3">Tests ready to launch immediately.</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                      </div>
                      <p className="text-xxs text-emerald-755 font-bold uppercase tracking-widest">Completed Sessions</p>
                      <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{completedExams.length}</h3>
                      <p className="text-xxs text-slate-500 font-medium mt-3">Submissions recorded on database.</p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Trophy className="h-16 w-16 text-indigo-600" />
                      </div>
                      <p className="text-xxs text-indigo-755 font-bold uppercase tracking-widest">Average Marks Percentage</p>
                      <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
                        {completedExams.length > 0 
                          ? `${Math.round((completedExams.reduce((acc, curr) => acc + (curr.submission?.score || 0), 0) / (completedExams.length * 30)) * 100)}%`
                          : 'N/A'
                        }
                      </h3>
                      <p className="text-xxs text-slate-500 font-medium mt-3">Based on cumulative grading reports.</p>
                    </div>
                  </div>

                  {/* Active Exam Action Banner */}
                  {activeExams.length > 0 ? (
                    <div className="bg-blue-600/5 border border-blue-500/25 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-bold text-blue-900 text-sm flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                          <span>Active CBT Console Available</span>
                        </h4>
                        <p className="text-xs text-slate-600">The exam <strong className="text-slate-900 font-bold">"{activeExams[0].title}"</strong> is currently open for your roll number.</p>
                      </div>
                      <button
                        onClick={() => navigate(`/exams/${activeExams[0]._id}`)}
                        className="self-start sm:self-auto py-2.5 px-6 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/15 transition-all cursor-pointer"
                      >
                        {activeExams[0].studentStatus === 'ongoing' ? 'Resume CBT' : 'Launch CBT'}
                      </button>
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs font-semibold bg-slate-50/50">
                      No active tests found at this time.
                    </div>
                  )}

                  {/* Notifications / CBT Rules Guidelines */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Lock className="h-4 w-4 text-slate-650" /> Portal Rules & Proctoring Compliance
                    </h3>
                    <ul className="space-y-2 text-xxs font-semibold text-slate-600">
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 shrink-0"></span>
                        <span>Keep the browser tab in full focus. Moving away or opening other software logs warning audits.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 shrink-0"></span>
                        <span>Ensure your keyboard and webcam proctor indicators are not blocked. All key events and focus blur events are synced to the admin live board.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 shrink-0"></span>
                        <span>In case of terminal shutdown, re-authenticate immediately on this browser client to resume the autosaved workspace.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 2: EXAMS */}
              {activeTab === 'exams' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-xl font-black text-slate-900">Assigned CBT Sessions</h2>
                    <p className="text-xs text-slate-550 mt-1">Review live tests or upcoming schedules assigned to your profile.</p>
                  </div>

                  <div className="space-y-4">
                    {/* Active list */}
                    {activeExams.map(exam => (
                      <div key={exam._id} className="border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-250 text-emerald-700 text-xxs font-bold rounded uppercase">Active</span>
                            <h3 className="font-bold text-slate-900 text-sm">{exam.title}</h3>
                          </div>
                          <p className="text-xxs text-slate-500 max-w-xl font-medium leading-relaxed">{exam.description || 'No description provided.'}</p>
                          <div className="flex gap-4 text-slate-455 text-xxs font-bold uppercase tracking-wider pt-1">
                            <span>Questions: {exam.totalQuestions || 30}</span>
                            <span>Duration: {exam.duration || 60} Min</span>
                            <span>Passing: {exam.passingPercentage}%</span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/exams/${exam._id}`)}
                          className="self-start sm:self-auto py-2 px-5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm transition-all duration-200 cursor-pointer"
                        >
                          {exam.studentStatus === 'ongoing' ? 'Resume Test' : 'Open Test'}
                        </button>
                      </div>
                    ))}

                    {/* Upcoming list */}
                    {upcomingExams.map(exam => (
                      <div key={exam._id} className="border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50 opacity-80">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-amber-100 border border-amber-250 text-amber-700 text-xxs font-bold rounded uppercase">Scheduled</span>
                            <h3 className="font-bold text-slate-800 text-sm">{exam.title}</h3>
                          </div>
                          <p className="text-xxs text-slate-500 max-w-xl font-medium leading-relaxed">{exam.description}</p>
                          <div className="flex gap-4 text-slate-455 text-xxs font-bold uppercase tracking-wider pt-1">
                            <span>Starts: {new Date(exam.startDate).toLocaleDateString()}</span>
                            <span>Ends: {new Date(exam.endDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          disabled
                          className="self-start sm:self-auto py-2 px-5 bg-slate-200 text-slate-450 border border-slate-300/60 rounded-xl text-xs font-bold cursor-not-allowed"
                        >
                          Not Started
                        </button>
                      </div>
                    ))}

                    {activeExams.length === 0 && upcomingExams.length === 0 && (
                      <div className="text-center py-16 text-slate-400 border border-dashed rounded-2xl bg-slate-50/50 text-xs font-semibold">
                        No assigned test schedules found.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: RESULTS */}
              {activeTab === 'results' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-xl font-black text-slate-900">My Exam Submissions</h2>
                    <p className="text-xs text-slate-550 mt-1">Review your score sheets and pass/fail evaluations.</p>
                  </div>

                  <div className="space-y-4">
                    {completedExams.map(exam => (
                      <div key={exam._id} className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">{exam.title}</h3>
                          {exam.submission ? (
                            <span className={`px-3 py-1 rounded-full text-xxs font-bold border ${
                              exam.submission.status === 'pass' 
                                ? 'bg-emerald-50 border-emerald-250 text-emerald-700' 
                                : 'bg-red-50 border-red-250 text-red-700'
                            }`}>
                              {exam.submission.status.toUpperCase()}
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xxs font-bold">
                              EVALUATING
                            </span>
                          )}
                        </div>

                        {exam.submission ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                              <p className="text-slate-455 text-xxs font-bold uppercase tracking-wider">Total Score</p>
                              <p className="text-lg font-black text-slate-900 mt-1">{exam.submission.score} / 30</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                              <p className="text-slate-455 text-xxs font-bold uppercase tracking-wider">Accuracy (%)</p>
                              <p className="text-lg font-black text-slate-900 mt-1">{exam.submission.accuracy}%</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                              <p className="text-slate-455 text-xxs font-bold uppercase tracking-wider">Passing Mark</p>
                              <p className="text-lg font-black text-slate-900 mt-1">{exam.passingPercentage}%</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                              <p className="text-slate-455 text-xxs font-bold uppercase tracking-wider">Submitted At</p>
                              <p className="text-xs font-bold text-slate-700 mt-2">
                                {new Date(exam.submission.submittedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">Submission data unavailable or final grading pending.</p>
                        )}
                      </div>
                    ))}

                    {completedExams.length === 0 && (
                      <div className="text-center py-16 text-slate-400 border border-dashed rounded-2xl bg-slate-50/50 text-xs font-semibold">
                        No submissions recorded on this portal.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: LEADERBOARD */}
              {activeTab === 'leaderboard' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-black text-slate-900">Assessment Rankings</h2>
                      <p className="text-xs text-slate-550 mt-1">Track candidate evaluations sorted by performance details.</p>
                    </div>
                    
                    <div className="w-full sm:w-64">
                      <select
                        value={selectedLeaderboardExam}
                        onChange={(e) => setSelectedLeaderboardExam(e.target.value)}
                        className="block w-full border border-slate-250 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                      >
                        <option value="">Select Examination</option>
                        {exams.map(e => (
                          <option key={e._id} value={e._id}>{e.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {leaderboardLoading ? (
                    <div className="flex justify-center items-center py-16">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                      <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-550 text-xxs">
                          <tr>
                            <th className="px-6 py-3.5 text-left">Rank</th>
                            <th className="px-6 py-3.5 text-left">Candidate Name</th>
                            <th className="px-6 py-3.5 text-left">Roll Number</th>
                            <th className="px-6 py-3.5 text-left">Score</th>
                            <th className="px-6 py-3.5 text-left">Accuracy</th>
                            <th className="px-6 py-3.5 text-left">Time Taken</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100 font-medium text-slate-700">
                          {leaderboardData.map((row) => (
                            <tr 
                              key={row.rollNumber}
                              className={row.rollNumber === user?.rollNumber ? 'bg-blue-50/50 font-bold text-blue-900' : 'hover:bg-slate-50/60'}
                            >
                              <td className="px-6 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xxs border ${
                                  row.rank === 1 ? 'bg-yellow-50 text-yellow-700 border-yellow-250' :
                                  row.rank === 2 ? 'bg-slate-100 text-slate-700 border-slate-200' :
                                  row.rank === 3 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-150'
                                }`}>
                                  {row.rank}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap font-bold text-slate-900">{row.studentName}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-500">{row.rollNumber}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-950 font-extrabold">{row.score} / 30</td>
                              <td className="px-6 py-3 whitespace-nowrap">{row.accuracy}%</td>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-500">
                                {Math.floor(row.submissionTimeSeconds / 60)}m {row.submissionTimeSeconds % 60}s
                              </td>
                            </tr>
                          ))}
                          
                          {leaderboardData.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-6 py-16 text-center text-slate-400 text-xs font-semibold bg-slate-50/40">
                                Select an examination from the dropdown menu to view performance ranks.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: PROFILE */}
              {activeTab === 'profile' && (
                <div className="space-y-6 max-w-xl animate-fade-in-up">
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-xl font-black text-slate-900">Profile Settings</h2>
                    <p className="text-xs text-slate-550 mt-1">Manage contact fields and portal keys.</p>
                  </div>

                  {profileMsg && (
                    <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-xs font-semibold">
                      {profileMsg}
                    </div>
                  )}
                  {profileError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-semibold">
                      {profileError}
                    </div>
                  )}

                  <form onSubmit={handleProfileUpdate} className="space-y-4 text-xs font-semibold">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-550 uppercase tracking-wider mb-1 text-xxs font-bold">Student Roll Number</label>
                        <input
                          type="text"
                          disabled
                          value={user?.rollNumber}
                          className="block w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl cursor-not-allowed"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-slate-550 uppercase tracking-wider mb-1 text-xxs font-bold">Email Address</label>
                        <input
                          type="text"
                          disabled
                          value={user?.email}
                          className="block w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 uppercase tracking-wider mb-1 text-xxs font-bold">Full Name</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-150"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-700 uppercase tracking-wider mb-1 text-xxs font-bold">Phone Number</label>
                        <input
                          type="text"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-150"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 uppercase tracking-wider mb-1 text-xxs font-bold">Academic Year</label>
                        <select
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          className="block w-full px-3.5 py-2.5 bg-slate-55 border border-slate-200 text-slate-805 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-150"
                        >
                          <option>First Year</option>
                          <option>Second Year</option>
                          <option>Third Year</option>
                          <option>Final Year</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 uppercase tracking-wider mb-1 text-xxs font-bold">Update Password (Optional)</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current password"
                        className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-150"
                      />
                    </div>

                    <button
                      type="submit"
                      className="py-2.5 px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition duration-150 shadow-md shadow-blue-500/10 cursor-pointer"
                    >
                      Update Profile
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
