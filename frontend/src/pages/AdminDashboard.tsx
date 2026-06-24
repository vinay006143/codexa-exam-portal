import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

import { 
  LayoutDashboard, Users, BookOpen, FileSpreadsheet, Monitor, 
  ShieldAlert, ListFilter, RefreshCw, Plus, Edit2, Trash2, 
  Download, Search, ShieldCheck, Database, Calendar, CheckSquare, Clock 
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);

  // Active Admin Sub-Panel Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'questions' | 'exams' | 'live' | 'results' | 'audit' | 'settings'>('overview');

  // Server Data States
  const [stats, setStats] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [liveStudents, setLiveStudents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter & Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');

  // Modals / Form States
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({ id: '', fullName: '', email: '', phone: '', rollNumber: '', year: '', password: '' });
  const [showImportModal, setShowImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionForm, setQuestionForm] = useState({ id: '', title: '', description: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A', category: '', difficulty: 'easy' });

  const [showExamModal, setShowExamModal] = useState(false);
  const [examForm, setExamForm] = useState({ id: '', title: '', description: '', totalQuestions: 30, duration: 60, passingPercentage: 50, startDate: '', endDate: '', status: 'draft' });

  // Load backend statistics and lists
  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // Stats
      const statsRes = await fetch('http://localhost:5000/api/admin/stats', { headers });
      if (!statsRes.ok) throw new Error('Stats fetch error');
      const statsData = await statsRes.json();
      setStats(statsData);

      // Students
      const stuRes = await fetch('http://localhost:5000/api/admin/students', { headers });
      const stuData = await stuRes.json();
      setStudents(stuData);

      // Questions
      const qRes = await fetch('http://localhost:5000/api/admin/questions', { headers });
      const qData = await qRes.json();
      setQuestions(qData);

      // Exams
      const examRes = await fetch('http://localhost:5000/api/admin/exams', { headers });
      const examData = await examRes.json();
      setExams(examData);

      // Submissions (Results)
      const resRes = await fetch('http://localhost:5000/api/admin/results', { headers });
      const resData = await resRes.json();
      setResults(resData);

      // Audit Logs
      const logRes = await fetch('http://localhost:5000/api/admin/audit-logs', { headers });
      const logData = await logRes.json();
      setAuditLogs(logData);

      // Live monitoring (initial fetch)
      const liveRes = await fetch('http://localhost:5000/api/admin/live-monitoring', { headers });
      const liveData = await liveRes.json();
      setLiveStudents(liveData);

    } catch (err: any) {
      setError(err.message || 'Failed to pull admin records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token, activeTab]);

  // Setup WebSocket live listening
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('admin_join');

    // Handle real-time updates of student status changes
    socketRef.current.on('student_status_change', (data) => {
      setLiveStudents((prev) => {
        const index = prev.findIndex((s) => s.studentId === data.studentId);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data };
          return updated;
        } else {
          return [data, ...prev];
        }
      });
    });

    socketRef.current.on('student_left', (data) => {
      setLiveStudents((prev) => prev.filter((s) => s.studentId !== data.studentId));
    });

    socketRef.current.on('new_submission_received', (data) => {
      // Refresh statistics and results
      fetchAllData();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // CRUD Ops: STUDENTS
  const saveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!studentForm.id;
      const url = isEdit ? `http://localhost:5000/api/admin/students/${studentForm.id}` : 'http://localhost:5000/api/admin/students';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(studentForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Student save failed');

      setShowStudentModal(false);
      setStudentForm({ id: '', fullName: '', email: '', phone: '', rollNumber: '', year: 'First Year', password: '' });
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteStudent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student and all their exam logs?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // CRUD Ops: QUESTIONS
  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!questionForm.id;
      const url = isEdit ? `http://localhost:5000/api/admin/questions/${questionForm.id}` : 'http://localhost:5000/api/admin/questions';
      const method = isEdit ? 'PUT' : 'POST';

      const bodyData = {
        title: questionForm.title,
        description: questionForm.description,
        options: [questionForm.optionA, questionForm.optionB, questionForm.optionC, questionForm.optionD],
        correctAnswer: questionForm.correctAnswer,
        category: questionForm.category,
        difficulty: questionForm.difficulty
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Question save failed');

      setShowQuestionModal(false);
      setQuestionForm({ id: '', title: '', description: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A', category: '', difficulty: 'easy' });
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const wipeQuestionBank = async () => {
    if (!confirm('WARNING: Are you sure you want to permanently delete ALL questions in the question bank? This cannot be undone.')) return;
    try {
      const res = await fetch('http://localhost:5000/api/admin/questions', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wipe failed');
      alert(data.message || 'Question bank wiped successfully.');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // CRUD Ops: EXAMS
  const saveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!examForm.id;
      const url = isEdit ? `http://localhost:5000/api/admin/exams/${examForm.id}` : 'http://localhost:5000/api/admin/exams';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(examForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Exam save failed');

      setShowExamModal(false);
      setExamForm({ id: '', title: '', description: '', totalQuestions: 30, duration: 60, passingPercentage: 50, startDate: '', endDate: '', status: 'draft' });
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteExam = async (id: string) => {
    if (!confirm('Delete this exam? All student assignments and scores for this exam will be wiped.')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/exams/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Bulk Student Import
  const handleBulkImport = async () => {
    try {
      const parsed = JSON.parse(bulkImportText);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON data must be a top-level array of objects.');
      }

      const res = await fetch('http://localhost:5000/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ students: parsed })
      });
      const data = await res.json();
      
      alert(data.message || 'Import done.');
      setShowImportModal(false);
      setBulkImportText('');
      fetchAllData();
    } catch (err: any) {
      alert(`Import error: ${err.message}. Ensure valid JSON format.`);
    }
  };

  // EXPORT: Excel Reports
  const exportToExcel = () => {
    const formatted = results.map((r, idx) => ({
      Rank: idx + 1,
      'Student Name': r.studentName,
      'Roll Number': r.rollNumber,
      Email: r.email,
      'Phone Number': r.phone,
      'Academic Year': r.academicYear,
      'Exam Title': r.examTitle,
      Score: `${r.score} / 30`,
      'Accuracy (%)': `${r.accuracy}%`,
      'Correct Answers': r.totalCorrect,
      'Wrong Answers': r.totalWrong,
      'Unanswered Questions': r.totalUnanswered,
      'Time Taken': `${Math.floor(r.submissionTimeSeconds / 60)}m ${r.submissionTimeSeconds % 60}s`,
      'Submitted At': new Date(r.submittedAt).toLocaleString(),
      Status: r.status.toUpperCase()
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exam Results");
    XLSX.writeFile(wb, "CodeRank_CBT_Final_Report.xlsx");
  };

  // EXPORT: PDF Reports
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("CODERANK CBT PRO - EXAMINATION REPORT", 14, 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 14, 21);
    
    // Summary Cards block
    if (stats) {
      const { totalStudents, appearedStudents, passedStudents, averageScore, averageAccuracy } = stats.cards;
      doc.text(`Total Registered Students: ${totalStudents}  |  Appeared: ${appearedStudents}  |  Passed: ${passedStudents}  |  Average Score: ${averageScore}/30  |  Average Accuracy: ${averageAccuracy}%`, 14, 28);
    }

    const tableRows = results.map((r, idx) => [
      idx + 1,
      r.studentName,
      r.rollNumber,
      r.examTitle,
      `${r.score}/30`,
      `${r.accuracy}%`,
      `${Math.floor(r.submissionTimeSeconds / 60)}m`,
      r.status.toUpperCase()
    ]);

    (doc as any).autoTable({
      startY: 34,
      head: [['Rank', 'Student Name', 'Roll Number', 'Exam Title', 'Score', 'Accuracy', 'Time Taken', 'Status']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 44, 89], textColor: [255, 255, 255] },
      styles: { fontSize: 8 }
    });

    doc.save("CodeRank_CBT_Report.pdf");
  };

  // Filtering Logic
  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuestions = questions.filter(q => {
    const matchSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) || q.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDiff = filterDifficulty ? q.difficulty === filterDifficulty : true;
    const matchCat = filterCategory ? q.category === filterCategory : true;
    return matchSearch && matchDiff && matchCat;
  });

  const sortedResults = [...results].filter(r => 
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.examTitle.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'score-desc') return b.score - a.score;
    if (sortBy === 'score-asc') return a.score - b.score;
    if (sortBy === 'accuracy-desc') return b.accuracy - a.accuracy;
    if (sortBy === 'accuracy-asc') return a.accuracy - b.accuracy;
    if (sortBy === 'time-asc') return a.submissionTimeSeconds - b.submissionTimeSeconds;
    return a.studentName.localeCompare(b.studentName);
  });

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800 animate-fade-in-up">
      {/* Top Admin Header */}
      <header className="bg-white border-b border-slate-200/80 shadow-sm py-4 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-xl text-blue-650">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <span className="font-black tracking-wide text-sm text-slate-900 uppercase">CODERANK ADMIN PORTAL</span>
            <span className="text-[10px] block text-slate-500 font-bold uppercase tracking-wider">Enterprise CBT Statistics & Live Logs</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchAllData}
            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 border border-slate-200/60 transition cursor-pointer"
            title="Refresh All Lists"
          >
            <RefreshCw className="h-4 w-4 animate-hover" />
          </button>
          <button
            onClick={logout}
            className="py-2 px-4 bg-red-50 hover:bg-red-100 border border-red-200/60 text-red-650 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Admin Interface Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Sidebar Tabs */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200/80 flex flex-col shrink-0">
          <nav className="flex-1 p-4 space-y-1.5">
            <button
              onClick={() => { setActiveTab('overview'); setSearchQuery(''); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'overview' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100/50 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <LayoutDashboard className="h-4.5 w-4.5" />
              <span>Dashboard Overview</span>
            </button>
            <button
              onClick={() => { setActiveTab('students'); setSearchQuery(''); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'students' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100/50 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <Users className="h-4.5 w-4.5" />
              <span>Students Portal</span>
            </button>
            <button
              onClick={() => { setActiveTab('questions'); setSearchQuery(''); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'questions' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100/50 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <BookOpen className="h-4.5 w-4.5" />
              <span>Question Bank ({questions.length})</span>
            </button>
            <button
              onClick={() => { setActiveTab('exams'); setSearchQuery(''); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'exams' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100/50 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <Calendar className="h-4.5 w-4.5" />
              <span>Exams Scheduler</span>
            </button>
            <button
              onClick={() => { setActiveTab('live'); setSearchQuery(''); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'live' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100/50 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Monitor className="h-4.5 w-4.5 animate-pulse text-red-500" />
                <span>Live Test Monitoring</span>
              </div>
              {liveStudents.filter(s => s.status === 'active').length > 0 && (
                <span className="bg-red-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full">
                  {liveStudents.filter(s => s.status === 'active').length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('results'); setSearchQuery(''); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'results' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100/50 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <FileSpreadsheet className="h-4.5 w-4.5" />
              <span>Exams Results & Reports</span>
            </button>
            <button
              onClick={() => { setActiveTab('audit'); setSearchQuery(''); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'audit' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100/50 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 border border-transparent'
              }`}
            >
              <ShieldAlert className="h-4.5 w-4.5" />
              <span>Security Audit Logs</span>
            </button>
          </nav>
        </aside>

        {/* Content Panel */}
        <main className="flex-1 p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded mb-6 border border-red-200">
              {error}
            </div>
          )}

          {loading && !stats ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Re-indexing statistics ledger...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && stats && (
                <div className="space-y-8">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-100/50 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Students</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">{stats.cards.totalStudents}</p>
                      </div>
                      <div className="bg-blue-50 text-blue-600 p-3 rounded-xl shrink-0">
                        <Users className="h-5.5 w-5.5" />
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-100/50 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exam Submissions</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">{stats.cards.appearedStudents}</p>
                      </div>
                      <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl shrink-0">
                        <FileSpreadsheet className="h-5.5 w-5.5" />
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-100/50 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pass Turnout (%)</p>
                        <p className="text-3xl font-black text-emerald-600 mt-1">
                          {stats.cards.appearedStudents > 0 
                            ? `${Math.round((stats.cards.passedStudents / stats.cards.appearedStudents) * 100)}%` 
                            : '0%'
                          }
                        </p>
                      </div>
                      <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl shrink-0">
                        <ShieldCheck className="h-5.5 w-5.5" />
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-100/50 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Score</p>
                        <p className="text-3xl font-black text-amber-600 mt-1">{stats.cards.averageScore} / 30</p>
                      </div>
                      <div className="bg-amber-50 text-amber-600 p-3 rounded-xl shrink-0">
                        <BookOpen className="h-5.5 w-5.5" />
                      </div>
                    </div>
                  </div>

                  {/* Analytic Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Score Distribution Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-100/50">
                      <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Score Distribution (Points / Student count)</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.charts.scoreDist}>
                            <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                            <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={28} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Pass Fail Pie Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-100/50 flex flex-col justify-between">
                      <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Pass / Fail Ratio</h3>
                      <div className="h-56 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.charts.passFailDist}
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              <Cell fill="#10b981" />
                              <Cell fill="#f43f5e" />
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-6 text-xs mt-2 font-bold">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                          <span className="text-slate-600">Passed: {stats.cards.passedStudents}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-rose-500 rounded-full"></span>
                          <span className="text-slate-600">Failed: {stats.cards.failedStudents}</span>
                        </div>
                      </div>
                    </div>

                    {/* Accuracy Range distribution AreaChart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-100/50 lg:col-span-2">
                      <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Student Accuracy Turnout</h3>
                      <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={stats.charts.accuracyDist}>
                            <defs>
                              <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                            <Area type="monotone" dataKey="count" stroke="#4f46e5" fill="url(#accuracyGrad)" strokeWidth={2.5} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 2: STUDENTS PORTAL */}
              {activeTab === 'students' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Student Directory</h2>
                      <p className="text-xs text-slate-500 font-bold">Create records, perform bulk import, or search directory logs.</p>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          setStudentForm({ id: '', fullName: '', email: '', phone: '', rollNumber: '', year: 'First Year', password: '' });
                          setShowStudentModal(true);
                        }}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Student</span>
                      </button>
                      <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        <span>Bulk Import</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative max-w-md">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by roll number, name, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700"
                    />
                  </div>

                  {/* Student Records Table */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm shadow-slate-100/50">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Name</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Roll Number</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Email</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Phone</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Academic Year</th>
                            <th className="px-6 py-3.5 text-right font-bold text-slate-500 uppercase tracking-wider text-[10px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {filteredStudents.map(student => (
                            <tr key={student._id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">{student.fullName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono font-bold">{student.rollNumber}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-semibold">{student.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-semibold">{student.phone}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-semibold">{student.year}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
                                <button
                                  onClick={() => {
                                    setStudentForm({
                                      id: student._id,
                                      fullName: student.fullName,
                                      email: student.email,
                                      phone: student.phone,
                                      rollNumber: student.rollNumber,
                                      year: student.year || 'First Year',
                                      password: ''
                                    });
                                    setShowStudentModal(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit2 className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  onClick={() => deleteStudent(student._id)}
                                  className="text-red-650 hover:text-red-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" /> Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredStudents.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                                No students matching query criteria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: QUESTION BANK */}
              {activeTab === 'questions' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Question Catalog ({questions.length})</h2>
                      <p className="text-xs text-slate-500 font-bold">Configure questions, categorize by subjects, or set difficulty tiers.</p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={wipeQuestionBank}
                        className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-750 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-red-500/5"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Wipe Catalog</span>
                      </button>

                      <button
                        onClick={() => {
                          setQuestionForm({ id: '', title: '', description: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A', category: '', difficulty: 'easy' });
                          setShowQuestionModal(true);
                        }}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add New Question</span>
                      </button>
                    </div>
                  </div>

                  {/* Filters Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Search title / category..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700"
                    />

                    <select
                      value={filterDifficulty}
                      onChange={(e) => setFilterDifficulty(e.target.value)}
                      className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-600"
                    >
                      <option value="">All Difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>

                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-600"
                    >
                      <option value="">All Categories</option>
                      <option value="JavaScript">JavaScript</option>
                      <option value="DSA">DSA</option>
                      <option value="SQL">SQL</option>
                      <option value="Computer Networks">Computer Networks</option>
                      <option value="Operating Systems">Operating Systems</option>
                      <option value="Aptitude">Aptitude</option>
                    </select>
                  </div>

                  {/* Catalog Cards */}
                  <div className="space-y-4">
                    {filteredQuestions.map(q => (
                      <div key={q._id} className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold rounded-lg uppercase">{q.category}</span>
                            <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-lg uppercase border ${
                              q.difficulty === 'easy' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              q.difficulty === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'
                            }`}>{q.difficulty}</span>
                            <span className="text-[9px] text-green-700 font-bold bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-lg">Correct Answer: {q.correctAnswer}</span>
                          </div>
                          <h4 className="font-extrabold text-slate-900 text-sm">{q.title}</h4>
                          {q.description && (
                            <p className="text-xs text-slate-500 max-w-2xl font-mono truncate bg-slate-50 px-3 py-1.5 border border-slate-100 rounded-lg">{q.description}</p>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600 text-xxs pt-1 font-semibold">
                            <p className="flex items-center gap-1.5"><span className="w-4 h-4 bg-slate-100 border border-slate-200 flex items-center justify-center rounded font-bold text-slate-500">A</span> {q.options[0]}</p>
                            <p className="flex items-center gap-1.5"><span className="w-4 h-4 bg-slate-100 border border-slate-200 flex items-center justify-center rounded font-bold text-slate-500">B</span> {q.options[1]}</p>
                            <p className="flex items-center gap-1.5"><span className="w-4 h-4 bg-slate-100 border border-slate-200 flex items-center justify-center rounded font-bold text-slate-500">C</span> {q.options[2]}</p>
                            <p className="flex items-center gap-1.5"><span className="w-4 h-4 bg-slate-100 border border-slate-200 flex items-center justify-center rounded font-bold text-slate-500">D</span> {q.options[3]}</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3 shrink-0 self-end md:self-auto text-xs font-bold">
                          <button
                            onClick={() => {
                              setQuestionForm({
                                id: q._id,
                                title: q.title,
                                description: q.description || '',
                                optionA: q.options[0],
                                optionB: q.options[1],
                                optionC: q.options[2],
                                optionD: q.options[3],
                                correctAnswer: q.correctAnswer,
                                category: q.category,
                                difficulty: q.difficulty
                              });
                              setShowQuestionModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            Edit
                          </button>
                          <span className="text-slate-350">|</span>
                          <button
                            onClick={() => deleteQuestion(q._id)}
                            className="text-red-650 hover:text-red-800 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredQuestions.length === 0 && (
                      <div className="text-center py-12 border border-dashed rounded-2xl text-slate-400 font-semibold">
                        No questions match filters.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: EXAMS SCHEDULER */}
              {activeTab === 'exams' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Exam Schedules</h2>
                      <p className="text-xs text-slate-500 font-bold">Configure examination structures, timers, and scheduled active times.</p>
                    </div>

                    <button
                      onClick={() => {
                        setExamForm({ id: '', title: '', description: '', totalQuestions: 30, duration: 60, passingPercentage: 50, startDate: '', endDate: '', status: 'draft' });
                        setShowExamModal(true);
                      }}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create New Exam</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {exams.map(exam => (
                      <div key={exam._id} className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${
                              exam.status === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              exam.status === 'scheduled' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              exam.status === 'completed' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-red-50 border-red-200 text-red-700'
                            }`}>{exam.status}</span>
                            <h3 className="font-extrabold text-slate-900 text-base">{exam.title}</h3>
                          </div>
                          <p className="text-xs text-slate-500 max-w-xl font-semibold leading-relaxed">{exam.description}</p>
                          <div className="flex gap-4 text-slate-400 text-xxs font-bold uppercase tracking-wider">
                            <span>Questions: <strong className="text-slate-700">{exam.totalQuestions}</strong></span>
                            <span>Duration: <strong className="text-slate-700">{exam.duration} Min</strong></span>
                            <span>Passing: <strong className="text-slate-700">{exam.passingPercentage}%</strong></span>
                          </div>
                          <div className="text-slate-500 text-[10px] font-semibold">
                            <span>Window: {new Date(exam.startDate).toLocaleString()} — {new Date(exam.endDate).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex gap-3 text-xs font-bold">
                          <button
                            onClick={() => {
                              setExamForm({
                                id: exam._id,
                                title: exam.title,
                                description: exam.description || '',
                                totalQuestions: exam.totalQuestions,
                                duration: exam.duration,
                                passingPercentage: exam.passingPercentage,
                                startDate: new Date(exam.startDate).toISOString().slice(0, 16),
                                endDate: new Date(exam.endDate).toISOString().slice(0, 16),
                                status: exam.status
                              });
                              setShowExamModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            Edit Config
                          </button>
                          <span className="text-slate-350">|</span>
                          <button
                            onClick={() => deleteExam(exam._id)}
                            className="text-red-650 hover:text-red-850 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {exams.length === 0 && (
                      <div className="text-center py-12 border border-dashed rounded-2xl text-slate-400 font-semibold">
                        No exams scheduled.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: LIVE SURVEILLANCE MONITOR */}
              {activeTab === 'live' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Live Examination Monitoring</h2>
                    <p className="text-xs text-slate-500 font-bold">Real-time status feed of active test takers and security compliance flags.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 text-center shadow-sm shadow-slate-100/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Connections</p>
                      <p className="text-2xl font-black text-blue-600 mt-1">{liveStudents.filter(s => s.status === 'active').length}</p>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 text-center shadow-sm shadow-slate-100/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suspicious Offline / Disconnected</p>
                      <p className="text-2xl font-black text-yellow-600 mt-1">{liveStudents.filter(s => s.status === 'disconnected').length}</p>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 text-center shadow-sm shadow-slate-100/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exceeded Safety Violation Limit (≥3)</p>
                      <p className="text-2xl font-black text-red-600 mt-1">{liveStudents.filter(s => s.violationsCount >= 3).length}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm shadow-slate-100/50">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Student Name</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Roll Number</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Exam Title</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Progress</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Timer Remaining</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Violations</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Connection Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {liveStudents.map(student => (
                            <tr key={student.studentId} className={`hover:bg-slate-50/50 transition-colors ${student.violationsCount >= 3 ? 'bg-red-50/30 hover:bg-red-50/40' : ''}`}>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">{student.fullName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono font-bold">{student.rollNumber}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-semibold">{student.examTitle}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2 font-bold text-slate-700">
                                  <div className="w-24 bg-slate-100 border border-slate-200/60 rounded-full h-2">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${student.progress}%` }}></div>
                                  </div>
                                  <span>{student.progress}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono font-bold">
                                {student.timeRemaining ? `${Math.floor(student.timeRemaining / 60)}m ${student.timeRemaining % 60}s` : 'Calculating...'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold border ${
                                  student.violationsCount >= 3 ? 'bg-red-50 border-red-200 text-red-700' :
                                  student.violationsCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                }`}>
                                  {student.violationsCount} Violations
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  student.status === 'active' ? 'bg-green-50 border-green-200 text-green-700' :
                                  student.status === 'completed' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${student.status === 'active' ? 'bg-green-500' : student.status === 'completed' ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                                  {student.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {liveStudents.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-semibold">
                                No students are currently taking a test.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: RESULTS & REPORTS */}
              {activeTab === 'results' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Scorecard Ledger & Report Downloads</h2>
                      <p className="text-xs text-slate-500 font-bold">Query and export detailed examination scores to Excel and PDF formats.</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={exportToExcel}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all cursor-pointer"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Export Excel</span>
                      </button>
                      <button
                        onClick={exportToPDF}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-slate-500/10 hover:shadow-slate-500/20 transition-all cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        <span>Export PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Filters and Sorting bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Search student or exam title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700"
                    />

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-600"
                    >
                      <option value="name-asc">Name A-Z</option>
                      <option value="score-desc">Highest Score</option>
                      <option value="score-asc">Lowest Score</option>
                      <option value="accuracy-desc">Highest Accuracy</option>
                      <option value="accuracy-asc">Lowest Accuracy</option>
                      <option value="time-asc">Fastest Submission</option>
                    </select>
                  </div>

                  {/* Results Ledger Table */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm shadow-slate-100/50">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Rank</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Student Name</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Roll Number</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Exam Title</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Score</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Accuracy</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Time Taken</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {sortedResults.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">{r.studentName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono font-bold">{r.rollNumber}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-semibold">{r.examTitle}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-black">{r.score} / 30</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-bold">{r.accuracy}%</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono font-bold">
                                {Math.floor(r.submissionTimeSeconds / 60)}m {r.submissionTimeSeconds % 60}s
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  r.status === 'pass' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                                }`}>
                                  {r.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {sortedResults.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-semibold">
                                No submissions found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: SECURITY AUDIT LOGS */}
              {activeTab === 'audit' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">System Audit Trail Logs</h2>
                    <p className="text-xs text-slate-500 font-bold">Investigate administrative logins, test starts, and logged security warnings.</p>
                  </div>

                  {/* Audit Logs Table */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm shadow-slate-100/50">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Timestamp</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">User</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Roll No</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Action Type</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Activity Details</th>
                            <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">IP Address</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {auditLogs.map(log => (
                            <tr key={log.id} className={`hover:bg-slate-50/50 transition-colors ${log.action === 'security_violation' ? 'bg-red-50/20 hover:bg-red-50/30' : ''}`}>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono font-semibold">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">{log.userName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono font-semibold">{log.rollNumber}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${
                                  log.action === 'security_violation' ? 'bg-red-50 border-red-200 text-red-700' :
                                  log.action === 'login' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-700'
                                }`}>{log.action.toUpperCase()}</span>
                              </td>
                              <td className="px-6 py-4 text-slate-600 font-semibold">{log.details}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono font-semibold">{log.ipAddress}</td>
                            </tr>
                          ))}
                          {auditLogs.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                                Audit log history is empty.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* STUDENT REGISTRATION / UPDATE MODAL */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <h3 className="text-base font-black text-slate-900">{studentForm.id ? 'Edit Student Details' : 'Register New Student'}</h3>
            <form onSubmit={saveStudent} className="space-y-4 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-slate-600">Full Name</label>
                <input
                  type="text"
                  required
                  value={studentForm.fullName}
                  onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                  className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    required
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600">Roll Number</label>
                  <input
                    type="text"
                    required
                    value={studentForm.rollNumber}
                    onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">Academic Year</label>
                  <select
                    value={studentForm.year}
                    onChange={(e) => setStudentForm({ ...studentForm, year: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-bold text-slate-600"
                  >
                    <option>First Year</option>
                    <option>Second Year</option>
                    <option>Third Year</option>
                    <option>Final Year</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600">{studentForm.id ? 'Update Password (Optional)' : 'Password'}</label>
                <input
                  type="password"
                  required={!studentForm.id}
                  value={studentForm.password}
                  onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  placeholder={studentForm.id ? 'Leave blank' : 'Minimum 6 chars'}
                  className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 transition cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <h3 className="text-base font-black text-slate-900">Bulk Student Import</h3>
            <p className="text-xxs text-slate-500 font-semibold leading-relaxed">
              Paste a JSON array containing student information. Default password for imported students is set to <strong className="text-slate-700">"student123"</strong>.
            </p>
            <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl text-[10px] text-slate-600 font-mono leading-relaxed select-all">
              [<br />
              &nbsp;&nbsp;{`{ "fullName": "Alice Smith", "email": "alice@student.com", "phone": "1234567890", "rollNumber": "CS2601", "year": "Third Year" }`}<br />
              ]
            </div>
            
            <textarea
              rows={8}
              value={bulkImportText}
              onChange={(e) => setBulkImportText(e.target.value)}
              placeholder="Paste JSON array here..."
              className="w-full border border-slate-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 leading-normal"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 transition cursor-pointer"
              >
                Submit Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION BANK UPDATE MODAL */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <h3 className="text-base font-black text-slate-900">{questionForm.id ? 'Edit MCQ Details' : 'Add Question'}</h3>
            <form onSubmit={saveQuestion} className="space-y-4 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-slate-600">Question Title / Prompt</label>
                <input
                  type="text"
                  required
                  value={questionForm.title}
                  onChange={(e) => setQuestionForm({ ...questionForm, title: e.target.value })}
                  className="mt-1.5 block w-full border border-slate-205 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600">Question Description / Code Snippet</label>
                <textarea
                  rows={3}
                  value={questionForm.description}
                  onChange={(e) => setQuestionForm({ ...questionForm, description: e.target.value })}
                  className="mt-1.5 block w-full border border-slate-205 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-mono text-slate-700 leading-normal"
                  placeholder="Insert optional description or code snippet block"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600">Option A</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionA}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionA: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-205 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">Option B</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionB}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionB: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-205 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">Option C</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionC}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionC: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-205 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">Option D</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionD}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionD: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-205 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600">Correct Option</label>
                  <select
                    value={questionForm.correctAnswer}
                    onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-205 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-bold text-slate-600"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600">Category</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JavaScript, SQL"
                    value={questionForm.category}
                    onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-205 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">Difficulty</label>
                  <select
                    value={questionForm.difficulty}
                    onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-205 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-bold text-slate-600"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 transition cursor-pointer"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXAM SCHEDULER MODAL */}
      {showExamModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <h3 className="text-base font-black text-slate-900">{examForm.id ? 'Edit Exam Configurations' : 'Schedule New Exam'}</h3>
            <form onSubmit={saveExam} className="space-y-4 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-slate-600">Exam Name</label>
                <input
                  type="text"
                  required
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600">Exam Description</label>
                <textarea
                  rows={2}
                  value={examForm.description}
                  onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                  className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700 leading-normal"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600">Total Questions</label>
                  <input
                    type="number"
                    required
                    value={examForm.totalQuestions}
                    onChange={(e) => setExamForm({ ...examForm, totalQuestions: parseInt(e.target.value) || 30 })}
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">Duration (Min)</label>
                  <input
                    type="number"
                    required
                    value={examForm.duration}
                    onChange={(e) => setExamForm({ ...examForm, duration: parseInt(e.target.value) || 60 })}
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">Passing (%)</label>
                  <input
                    type="number"
                    required
                    value={examForm.passingPercentage}
                    onChange={(e) => setExamForm({ ...examForm, passingPercentage: parseInt(e.target.value) || 55 })}
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={examForm.startDate}
                    onChange={(e) => setExamForm({ ...examForm, startDate: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">End Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={examForm.endDate}
                    onChange={(e) => setExamForm({ ...examForm, endDate: e.target.value })}
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600">Exam Status</label>
                <select
                  value={examForm.status}
                  onChange={(e) => setExamForm({ ...examForm, status: e.target.value })}
                  className="mt-1.5 block w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-xs font-bold text-slate-600"
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 transition cursor-pointer"
                >
                  Save Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
