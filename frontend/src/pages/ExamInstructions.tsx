import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, BookOpen, AlertCircle, ArrowLeft, RefreshCw, HelpCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const ExamInstructions: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Declarations
  const [decRead, setDecRead] = useState(false);
  const [decRules, setDecRules] = useState(false);
  const [startLoading, setStartLoading] = useState(false);

  useEffect(() => {
    const fetchExamSpecs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/student/exams/${examId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch exam guidelines.');
        const data = await res.json();
        
        if (data.status === 'completed') {
          navigate('/dashboard'); // Already completed, kick back
          return;
        }

        setExam(data.exam);
      } catch (err: any) {
        setError(err.message || 'Error loading exam data.');
      } finally {
        setLoading(false);
      }
    };
    fetchExamSpecs();
  }, [examId, token]);

  const handleStartExam = async () => {
    if (!decRead || !decRules) return;
    setStartLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/student/exams/${examId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start exam.');
      }

      // Enter fullscreen and route to exam interface
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen().catch(() => {
          console.warn("Fullscreen permission denied or blocked by browser.");
        });
      }

      navigate(`/exams/${examId}/interface`);
    } catch (err: any) {
      setError(err.message || 'Server error while starting exam.');
      setStartLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-xs font-bold">Configuring CBT exam session details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Banner */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
            <BookOpen className="h-4 w-4 text-blue-600" />
          </div>
          <span className="font-extrabold text-slate-900 text-sm tracking-wide">CBT INSTRUCTIONS PANEL</span>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Exit to Dashboard</span>
        </button>
      </header>

      {/* Instructions Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col justify-between">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-md shadow-slate-200/50 space-y-6">
          
          {/* Exam Header Meta */}
          <div className="border-b border-slate-100 pb-4">
            <h1 className="text-2xl font-black text-slate-900 mb-1.5">{exam?.title}</h1>
            <p className="text-xs text-slate-550 leading-relaxed">{exam?.description}</p>
          </div>

          {/* Exam Specification Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-slate-555 text-xxs font-bold uppercase tracking-wider">Total Questions</p>
              <p className="text-xl font-extrabold text-blue-600 mt-1">{exam?.totalQuestions || 30}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-slate-555 text-xxs font-bold uppercase tracking-wider">Duration</p>
              <p className="text-xl font-extrabold text-blue-600 mt-1">{exam?.duration || 60} Minutes</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-slate-555 text-xxs font-bold uppercase tracking-wider">Marks Per Question</p>
              <p className="text-xl font-extrabold text-blue-600 mt-1">1.0 Mark</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-slate-555 text-xxs font-bold uppercase tracking-wider">Passing Threshold</p>
              <p className="text-xl font-extrabold text-blue-600 mt-1">{exam?.passingPercentage || 50}% Marks</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-750 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-650" />
              <span className="text-xs font-semibold">{error}</span>
            </div>
          )}

          {/* Examination Rules Section */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-blue-600" /> General Examination Guidelines
            </h3>
            <ol className="list-decimal pl-5 text-xs text-slate-600 space-y-2 leading-relaxed font-medium">
              <li>You will be assigned exactly {exam?.totalQuestions || 30} randomized multiple-choice questions locked to your candidate profile.</li>
              <li>No negative marking is applied. A correct answer scores 1 mark, unanswered or wrong answers score 0.</li>
              <li>Once you click "Start Exam", the countdown timer will begin immediately. Navigating away does not stop the timer.</li>
              <li>The test will automatically submit when the duration expires.</li>
              <li>You may use "Save & Next" to submit your answer or "Mark For Review" to review it later.</li>
            </ol>
          </div>

          {/* Security Rules Section */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-red-700 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-650" /> Mandatory Proctoring & Browser Lockdown Rules
            </h3>
            <ul className="list-disc pl-5 text-xs text-red-950 space-y-2 leading-relaxed font-semibold">
              <li><strong>Mandatory Fullscreen Mode</strong>: The exam MUST be taken in full screen. Exiting full screen will trigger a warning.</li>
              <li><strong>Tab Toggles / Window Blur</strong>: Do not switch tabs, adjust your browser size, or focus on other applications. All events are logged.</li>
              <li><strong>Automatic Submission</strong>: If you violate security terms 3 times (tab switches, exits, resizing), the test will **auto-submit** your current progress.</li>
              <li><strong>Input Disabling</strong>: Right-click, Copying, Pasting, and inspection keyboard shortcuts (F12, Ctrl+Shift+I, etc.) are fully disabled.</li>
            </ul>
          </div>

          {/* Declarations Selection */}
          <div className="border-t border-slate-100 pt-5 space-y-3 font-semibold">
            <label className="flex items-start gap-3 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={decRead}
                onChange={(e) => setDecRead(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-350 text-blue-600 focus:ring-blue-500 focus:ring-offset-white cursor-pointer"
              />
              <span>I have read, understood, and agreed to all standard and security rules outlined in this instructions panel.</span>
            </label>
            
            <label className="flex items-start gap-3 text-xs text-slate-605 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={decRules}
                onChange={(e) => setDecRules(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-350 text-blue-600 focus:ring-blue-500 focus:ring-offset-white cursor-pointer"
              />
              <span>I agree to follow the examination code of conduct. I understand that copy/paste is blocked and tab changes will log security flags.</span>
            </label>
          </div>

        </div>

        {/* Start Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleStartExam}
            disabled={!decRead || !decRules || startLoading}
            className="py-3 px-12 text-white rounded-xl font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200 border border-transparent shadow-lg shadow-blue-500/10 transition-all w-full sm:w-auto cursor-pointer"
          >
            {startLoading ? 'Launching Exam Environment...' : 'START EXAM'}
          </button>
        </div>
      </main>
    </div>
  );
};
