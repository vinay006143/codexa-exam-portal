import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Clock, RefreshCw, User, Monitor, Eye, Save, HelpCircle, Video, ShieldCheck, PenTool, BookOpen, UserCheck, X, Menu } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';

export const ExamInterface: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const socketRef = useRef<Socket | null>(null);

  // Exam States
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [questionStates, setQuestionStates] = useState<{ [key: string]: string }>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(3600); // 60 mins default (seconds)
  const [violationsCount, setViolationsCount] = useState(0);
  const [exam, setExam] = useState<any>(null);
  
  // Loading & UI States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  
  // Security Overlays
  const [isFullscreenExit, setIsFullscreenExit] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  // Refs for tracking mutable states in event listeners without re-binding
  const violationsRef = useRef(0);
  const answersRef = useRef(answers);
  const statesRef = useRef(questionStates);
  const timeRef = useRef(timeRemaining);

  // Sync refs
  useEffect(() => { violationsRef.current = violationsCount; }, [violationsCount]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { statesRef.current = questionStates; }, [questionStates]);
  useEffect(() => { timeRef.current = timeRemaining; }, [timeRemaining]);

  // Socket Connection for live monitoring
  useEffect(() => {
    socketRef.current = io(API_BASE_URL);

    socketRef.current.emit('student_join', {
      studentId: user?.id,
      fullName: user?.fullName,
      rollNumber: user?.rollNumber,
      examId
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [examId, user]);

  // Fetch locked questions & state
  const loadExamWorkspace = async () => {
    try {
      // Fetch exam details to get the exam title
      const examRes = await fetch(`${API_BASE_URL}/api/student/exams/${examId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const examData = await examRes.json();
      if (examRes.ok) {
        setExam(examData.exam);
      }

      const res = await fetch(`${API_BASE_URL}/api/student/exams/${examId}/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to retrieve exam questions.');
      }

      setQuestions(data.questions);
      setAnswers(data.answers || {});
      setQuestionStates(data.questionStates || {});
      setTimeRemaining(data.timeRemaining);
      setViolationsCount(data.violationsCount);
      violationsRef.current = data.violationsCount;

      // Set the first question state to 'not_answered' if it was not_visited
      const firstQId = data.questions[0]?.id;
      if (firstQId && (!data.questionStates || data.questionStates[firstQId] === 'not_visited')) {
        const nextStates = { ...data.questionStates, [firstQId]: 'not_answered' };
        setQuestionStates(nextStates);
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Error loading examination workspace.');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamWorkspace();
  }, [examId, token]);

  // Autosave function
  const triggerAutosave = async (forcedTime?: number) => {
    try {
      const currentAnswers = answersRef.current;
      const currentStates = statesRef.current;
      const currentRemaining = forcedTime !== undefined ? forcedTime : timeRef.current;
      const currentViolations = violationsRef.current;

      const res = await fetch(`${API_BASE_URL}/api/student/exams/${examId}/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          answers: currentAnswers,
          questionStates: currentStates,
          timeRemaining: currentRemaining,
          violationsCount: currentViolations
        })
      });

      if (socketRef.current) {
        const answeredCount = Object.keys(currentAnswers).length;
        const progress = Math.round((answeredCount / 30) * 100);
        socketRef.current.emit('student_update', {
          studentId: user?.id,
          violationsCount: currentViolations,
          progress,
          status: 'active'
        });
      }
    } catch (e) {
      console.error('Autosave sync failed:', e);
    }
  };

  // 5 seconds timer autosave loop
  useEffect(() => {
    if (loading || submitting) return;

    const interval = setInterval(() => {
      triggerAutosave();
    }, 5000);

    return () => clearInterval(interval);
  }, [loading, submitting]);

  // Countdown timer clock
  useEffect(() => {
    if (loading || submitting) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto submit
          handleFinalSubmit(true);
          return 0;
        }

        // Time Alerts warnings
        const alerts = [1800, 600, 300, 60]; // 30, 10, 5, 1 mins
        if (alerts.includes(prev - 1)) {
          const minutes = Math.floor((prev - 1) / 60);
          showWarning(`Time Alert: ${minutes} minute(s) remaining before auto-submit!`);
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, submitting]);

  // Security Enforcement System
  useEffect(() => {
    if (loading || submitting) return;

    // Check fullscreen exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreenExit(true);
        triggerViolation('Exited fullscreen mode. Fullscreen is mandatory during the exam.');
      } else {
        setIsFullscreenExit(false);
      }
    };

    // Tab Switch / Blur Check
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation('Tab switched or minimized. This is a severe exam security breach.');
      }
    };

    const handleWindowBlur = () => {
      triggerViolation('Browser window lost focus. Focus away from the test console is prohibited.');
    };

    // Block keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12
      if (e.key === 'F12') {
        e.preventDefault();
        triggerViolation('F12 Developer Tools block triggered.');
      }
      // Disable Ctrl+Shift+I, J, C, or Ctrl+U (view source), Ctrl+P (print)
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        triggerViolation('Inspect element shortcut blocked.');
      }
      if (e.ctrlKey && ['U', 'P', 'S'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        triggerViolation('Print / Source / Save shortcuts blocked.');
      }
    };

    // Block right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerViolation('Right-click contextual controls disabled.');
    };

    // Block copy / paste / cut
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation('Copy, Cut, and Paste controls disabled.');
    };

    // Block page refresh attempt
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to exit? Your progress is autosaved but reload logs a warning.';
      return e.returnValue;
    };

    // Attach listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [loading, submitting]);

  const triggerViolation = (msg: string) => {
    setViolationsCount(prev => {
      const nextVal = prev + 1;
      
      // Log to server immediately via autosave
      triggerAutosave();

      // Check max violations
      if (nextVal >= 3) {
        handleFinalSubmit(true, `Auto-submitted due to excessive security violations (${nextVal} violations).`);
      } else {
        showWarning(`SECURITY ALERT: ${msg} Warning count: ${nextVal}/3. Auto-submit will trigger at 3 violations.`);
      }
      
      return nextVal;
    });
  };

  const showWarning = (msg: string) => {
    setWarningMessage(msg);
    setShowWarningModal(true);
  };

  const requestFullscreenAgain = async () => {
    const docEl = document.documentElement;
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
        setIsFullscreenExit(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Evaluation & final submit
  const handleFinalSubmit = async (isAuto = false, customReason = '') => {
    if (submitting) return;

    // Enforce final 5 minutes check for manual submits
    const isSubmitActive = timeRemaining <= 300 || (exam?.duration && exam.duration * 60 <= 300);
    if (!isAuto && !isSubmitActive) {
      alert("Submission is only allowed during the final 5 minutes of the exam.");
      return;
    }

    setSubmitting(true);
    setError('');

    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.error(e));
    }

    try {
      // Force an autosave first
      await triggerAutosave();

      const res = await fetch(`${API_BASE_URL}/api/student/exams/${examId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isAuto })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Submission failed.');
      }

      alert(customReason || (isAuto ? 'Time expired. Your exam was submitted automatically.' : 'Exam submitted successfully!'));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error occurred while submitting exam.');
      setSubmitting(false);
    }
  };

  // Navigation handlers
  const handleJumpToQuestion = (index: number) => {
    // Save current states
    const currentQ = questions[currentIndex];
    const targetQ = questions[index];
    
    const updatedStates = { ...questionStates };
    
    // Set current question state
    if (!answers[currentQ.id]) {
      if (updatedStates[currentQ.id] !== 'marked_review') {
        updatedStates[currentQ.id] = 'not_answered';
      }
    } else {
      if (updatedStates[currentQ.id] !== 'marked_review') {
        updatedStates[currentQ.id] = 'answered';
      }
    }

    // Set target question state to blue/current if it was unvisited
    if (updatedStates[targetQ.id] === 'not_visited') {
      updatedStates[targetQ.id] = 'not_answered';
    }

    setQuestionStates(updatedStates);
    setCurrentIndex(index);
    triggerAutosave();
  };

  const handleSelectOption = (optionLetter: string) => {
    const currentQ = questions[currentIndex];
    const nextAnswers = { ...answers, [currentQ.id]: optionLetter };
    setAnswers(nextAnswers);

    // Update state to answered (only if not already marked for review)
    if (questionStates[currentQ.id] !== 'marked_review') {
      setQuestionStates(prev => ({ ...prev, [currentQ.id]: 'answered' }));
    }
  };

  const handleClearResponse = () => {
    const currentQ = questions[currentIndex];
    const nextAnswers = { ...answers };
    delete nextAnswers[currentQ.id];
    setAnswers(nextAnswers);

    setQuestionStates(prev => ({
      ...prev,
      [currentQ.id]: 'not_answered'
    }));
  };

  const handleSaveAndNext = () => {
    const currentQ = questions[currentIndex];
    const updatedStates = { ...questionStates };

    if (answers[currentQ.id]) {
      updatedStates[currentQ.id] = 'answered';
    } else {
      updatedStates[currentQ.id] = 'not_answered';
    }

    setQuestionStates(updatedStates);

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQ = questions[nextIndex];
      if (updatedStates[nextQ.id] === 'not_visited') {
        updatedStates[nextQ.id] = 'not_answered';
      }
      setCurrentIndex(nextIndex);
    }
    triggerAutosave();
  };

  const handleMarkReviewAndNext = () => {
    const currentQ = questions[currentIndex];
    const updatedStates = { ...questionStates };
    updatedStates[currentQ.id] = 'marked_review';
    setQuestionStates(updatedStates);

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQ = questions[nextIndex];
      if (updatedStates[nextQ.id] === 'not_visited') {
        updatedStates[nextQ.id] = 'not_answered';
      }
      setCurrentIndex(nextIndex);
    }
    triggerAutosave();
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3 font-sans">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-xs font-bold">Synchronizing question bank arrays and assignments...</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  // Scratchpad storage logic helper
  const handleScratchpadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    localStorage.setItem(`scratchpad_${examId}`, e.target.value);
  };
  const getScratchpadVal = () => {
    return localStorage.getItem(`scratchpad_${examId}`) || '';
  };

  const isSubmitActive = timeRemaining <= 300 || (exam?.duration && exam.duration * 60 <= 300);

  const renderSidebarContent = () => {
    return (
      <div className="flex flex-col h-full justify-between">
        <div className="p-5 space-y-6 flex-1 overflow-y-auto">
          
          {/* Candidate Box */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
              <UserCheck className="h-5 w-5 text-slate-500" />
            </div>
            <div className="text-xxs leading-relaxed">
              <p className="font-extrabold text-slate-900 text-xs">{user?.fullName}</p>
              <p className="text-slate-500 font-semibold uppercase tracking-wider">Roll No: {user?.rollNumber}</p>
            </div>
          </div>

          {/* Simulated Live Proctor Web Camera Panel */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-3.5 relative overflow-hidden aspect-video shadow-inner flex flex-col justify-end">
            <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600/90 border border-red-500/30 text-white text-[9px] font-black uppercase tracking-wider">
              <Video className="h-3 w-3 animate-pulse" />
              <span>Camera Connected</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
              <User className="h-16 w-16 text-white" />
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider relative z-10 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Security Engine Active</span>
            </div>
          </div>

          {/* Palette Grid */}
          <div className="space-y-3">
            <h3 className="text-xxs font-extrabold uppercase text-slate-500 tracking-wider">Question Navigation Palette</h3>
            <div className="grid grid-cols-5 gap-2.5">
              {questions.map((q, idx) => {
                const state = questionStates[q.id] || 'not_visited';
                const isSelected = idx === currentIndex;
                const hasAnswer = !!answers[q.id];
                
                let stateClass = 'palette-btn-not-visited'; 
                if (state === 'marked_review') {
                  if (hasAnswer) {
                    stateClass = 'palette-btn-answered-marked'; 
                  } else {
                    stateClass = 'palette-btn-marked'; 
                  }
                } else if (hasAnswer || state === 'answered') {
                  stateClass = 'palette-btn-answered'; 
                } else if (state === 'not_answered') {
                  stateClass = 'palette-btn-not-answered'; 
                }

                const selectedClass = isSelected ? 'ring-2 ring-blue-500 border-blue-500 scale-105 shadow-md z-10' : '';

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      handleJumpToQuestion(idx);
                      setIsSidebarOpen(false);
                    }}
                    className={`palette-btn w-9 h-9 !text-[10px] ${stateClass} ${selectedClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legends */}
          <div className="border-t border-slate-200 pt-4 space-y-2.5">
            <h4 className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Palette Legends</h4>
            <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[10px] text-slate-600 font-bold">
              <div className="flex items-center gap-2">
                <span className="palette-legend-icon palette-btn-answered">1</span>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="palette-legend-icon palette-btn-not-answered">2</span>
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="palette-legend-icon palette-btn-marked">3</span>
                <span>Mark Review</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="palette-legend-icon palette-btn-answered-marked">4</span>
                <span>Ans & Marked</span>
              </div>
              <div className="flex items-center gap-2 col-span-2 border-t border-slate-200/60 pt-2">
                <span className="palette-legend-icon palette-btn-not-visited">5</span>
                <span>Not Visited</span>
              </div>
            </div>
          </div>

          {/* Scratch Pad Area */}
          <div className="border-t border-slate-200 pt-4 space-y-1.5">
            <h4 className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <PenTool className="h-3.5 w-3.5 text-slate-500" />
              <span>Scratch Pad</span>
            </h4>
            <textarea
              defaultValue={getScratchpadVal()}
              onChange={handleScratchpadChange}
              placeholder="Write calculations or notes here..."
              rows={3}
              className="w-full text-xxs bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-normal"
            />
          </div>

        </div>

        {/* Submit Action (Disabled until final 5 minutes) */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 shrink-0">
          {isSubmitActive ? (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md shadow-red-500/10 transition-all cursor-pointer"
            >
              SUBMIT EXAMINATION
            </button>
          ) : (
            <div className="space-y-1.5">
              <button
                disabled
                className="w-full py-3 bg-slate-300 text-slate-500 font-extrabold text-xs tracking-wider uppercase rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 border border-slate-200"
              >
                SUBMIT LOCKED
              </button>
              <p className="text-[10px] text-center text-slate-500 font-bold leading-normal">
                Activates in last 5 minutes of exam (at {formatTimer(Math.min(300, (exam?.duration || 60) * 60))})
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none font-sans text-slate-800">
      
      {/* Top Banner Header (Real CBT Style) */}
      <header className="bg-slate-900 text-white px-4 md:px-6 py-2.5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-blue-600 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider shadow-sm hidden sm:block shrink-0">CBT CONSOLE</div>
          <span className="font-extrabold text-xs sm:text-sm tracking-wide truncate max-w-[150px] sm:max-w-xs md:max-w-md">{exam?.title || 'Examination Console'}</span>
        </div>

        {/* Center/Right Section Selector & Timer */}
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-lg text-xs font-semibold text-slate-300">
            <span>Subject: <strong className="text-white">Computer Science</strong></span>
          </div>

          {/* Glowing Timer */}
          <div className={`flex items-center gap-1.5 font-mono text-xs sm:text-sm md:text-base font-black px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg border ${
            timeRemaining < 300 
              ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse' 
              : 'bg-slate-950 text-emerald-400 border-slate-800'
          }`}>
            <Clock className="h-4 w-4 text-current animate-pulse" />
            <span>Time Left: {formatTimer(timeRemaining)}</span>
          </div>

          {/* Mobile Drawer Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition shadow-md cursor-pointer shrink-0"
          >
            <Menu className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Palette</span>
          </button>
        </div>
      </header>

      {/* CBT Section Selection Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-1.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-[10px] sm:text-xs font-bold tracking-wide uppercase">
            Section A: General Questions
          </button>
        </div>
        <div className="text-[9px] sm:text-xxs font-bold text-slate-500 uppercase tracking-widest">
          Proctor: ACTIVE
        </div>
      </div>

      {/* Main Testing Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

        {/* Left Workspace Pane (Question details) */}
        <div className="flex-1 flex flex-col bg-white overflow-y-auto border-r border-slate-200">
          <div className="p-4 sm:p-6 flex-1 space-y-6">
            
            {/* Question Information Details Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm font-extrabold text-blue-900 uppercase bg-blue-50 px-2 sm:px-3 py-1 rounded-lg">Question {currentIndex + 1}</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-500">Marks: <strong className="text-slate-900">+1.00</strong> | <strong className="text-slate-900">-0.00</strong></span>
              </div>
              <div className="flex gap-1.5 sm:gap-2">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] sm:text-xxs font-bold rounded-lg uppercase border border-slate-200">{currentQuestion?.category}</span>
                <span className={`px-2 py-0.5 text-[9px] sm:text-xxs font-bold rounded-lg uppercase border ${
                  currentQuestion?.difficulty === 'easy' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  currentQuestion?.difficulty === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>{currentQuestion?.difficulty}</span>
              </div>
            </div>

            {/* Question Text & Description */}
            <div className="space-y-4">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">Question Text:</h2>
              {currentQuestion?.title && (
                <div className="text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 leading-relaxed select-text font-sans">
                  {currentQuestion?.title}
                </div>
              )}
              {currentQuestion?.description && (
                <div className="text-[11px] sm:text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 font-mono overflow-x-auto whitespace-pre-wrap max-h-80 select-text">
                  {currentQuestion?.description}
                </div>
              )}
            </div>

            {/* Option Radio Selection Elements */}
            <div className="space-y-3 pt-2">
              <p className="text-[10px] sm:text-xxs font-bold uppercase tracking-wider text-slate-400">Select candidate option:</p>
              {currentQuestion?.options.map((option: string, idx: number) => {
                const letter = ['A', 'B', 'C', 'D'][idx];
                const isSelected = answers[currentQuestion.id] === letter;
                
                return (
                  <label
                    key={letter}
                    onClick={() => handleSelectOption(letter)}
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 border rounded-xl cursor-pointer transition-all duration-150 select-none ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50/40 text-blue-900 font-bold shadow-sm' 
                        : 'border-slate-200 hover:bg-slate-50/70 text-slate-700'
                    }`}
                  >
                    <span className={`flex items-center justify-center w-6 sm:w-6.5 h-6 sm:h-6.5 rounded-full border text-xs font-black transition-all shrink-0 ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}>
                      {letter}
                    </span>
                    <span className="text-xs font-semibold leading-snug">{option}</span>
                  </label>
                );
              })}
            </div>

          </div>

          {/* Bottom Action Deck */}
          <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex flex-wrap gap-2 justify-between items-center shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => currentIndex > 0 && handleJumpToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="py-1.5 sm:py-2 px-3 sm:px-5 bg-white border border-slate-200 rounded-xl text-[10px] sm:text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer shadow-sm"
              >
                Previous
              </button>
              <button
                onClick={handleClearResponse}
                disabled={!answers[currentQuestion?.id]}
                className="py-1.5 sm:py-2 px-3 sm:px-5 bg-white border border-red-200 text-red-650 rounded-xl text-[10px] sm:text-xs font-bold hover:bg-red-50 disabled:opacity-50 transition cursor-pointer shadow-sm"
              >
                Clear Response
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleMarkReviewAndNext}
                className="py-1.5 sm:py-2 px-3 sm:px-5 bg-purple-50 hover:bg-purple-100/80 border border-purple-200 text-purple-750 rounded-xl text-[10px] sm:text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Mark Review & Next
              </button>
              <button
                onClick={handleSaveAndNext}
                className="py-1.5 sm:py-2 px-4 sm:px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] sm:text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-500/10"
              >
                Save & Next
              </button>
            </div>
          </div>
        </div>

        {/* Right Workspace Sidebar Panel (Desktop/Tablet landscape only) */}
        <div className="hidden md:flex md:w-80 bg-slate-50 border-l border-slate-200 flex-col shrink-0 overflow-hidden">
          {renderSidebarContent()}
        </div>

      </div>

      {/* Responsive Drawer Overlay (Mobile/Tablet portrait only) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-955/60 backdrop-blur-sm z-40 md:hidden flex justify-end transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div 
            className="w-80 max-w-[85vw] h-full bg-slate-50 border-l border-slate-200 shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Exam Information</h3>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Drawer Sidebar Content */}
            <div className="flex-1 overflow-hidden">
              {renderSidebarContent()}
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN EXIT OVERLAY SECURITY GATEWAY */}
      {isFullscreenExit && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col justify-center items-center text-white z-50 p-6 text-center">
          <Monitor className="h-16 w-16 text-red-500 animate-bounce mb-4 animate-pulse" />
          <h2 className="text-2xl font-black text-red-400 mb-2">FULLSCREEN MODE EXITED</h2>
          <p className="text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
            Fullscreen is mandatory to ensure testing integrity. Continuing outside fullscreen constitutes an exam violation.
          </p>
          <button
            onClick={requestFullscreenAgain}
            className="py-3 px-8 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/10 transition cursor-pointer"
          >
            Re-enter Fullscreen Mode
          </button>
        </div>
      )}

      {/* WARNING MODAL DIALOGUE */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-600 border-b border-slate-100 pb-2">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-extrabold uppercase tracking-wide">Exam Safety Flag</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
              {warningMessage}
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowWarningModal(false)}
                className="py-2 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Acknowledge Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXAM SUBMIT DOUBLE CONFIRMATION MODAL */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-2">Confirm Exam Submission</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Are you sure you want to submit your exam? Once submitted, you cannot change your answers.
            </p>
            
            {/* Quick stats review */}
            <div className="bg-slate-50 p-4 rounded-xl text-xxs font-bold space-y-2 text-slate-600 border border-slate-200">
              <p className="flex justify-between">
                <span>Answered Questions:</span>
                <span className="text-emerald-700 font-extrabold">{Object.keys(answers).length} / {questions.length}</span>
              </p>
              <p className="flex justify-between">
                <span>Marked for Review:</span>
                <span className="text-purple-700 font-extrabold">{Object.values(questionStates).filter(s => s === 'marked_review').length}</span>
              </p>
              <p className="flex justify-between border-t border-slate-200/60 pt-2 text-slate-500 font-semibold">
                <span>Unanswered / Unvisited:</span>
                <span>{questions.length - Object.keys(answers).length}</span>
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs text-slate-650 transition font-bold cursor-pointer"
              >
                Return to Exam
              </button>
              <button
                onClick={() => handleFinalSubmit(false)}
                disabled={submitting}
                className="py-2 px-5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md shadow-red-500/10 transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
