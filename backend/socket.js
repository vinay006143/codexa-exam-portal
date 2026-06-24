import { Server } from 'socket.io';

let io;
const activeStudents = new Map(); // studentId -> { socketId, fullName, rollNumber, examId, lastActive, violationsCount, score, totalQuestions, status }

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all for local development, adjust for production
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room or identify role
    socket.on('admin_join', () => {
      socket.join('admins');
      // Send current list of active students to the admin
      socket.emit('active_students_list', Array.from(activeStudents.values()));
      console.log(`Admin joined monitoring: ${socket.id}`);
    });

    socket.on('student_join', ({ studentId, fullName, rollNumber, examId }) => {
      socket.join(`exam_${examId}`);
      
      const studentData = {
        socketId: socket.id,
        studentId,
        fullName,
        rollNumber,
        examId,
        lastActive: new Date(),
        violationsCount: 0,
        progress: 0,
        status: 'active'
      };
      
      activeStudents.set(studentId, studentData);
      socket.studentId = studentId;

      // Broadcast to admins
      io.to('admins').emit('student_status_change', studentData);
      console.log(`Student ${fullName} (${rollNumber}) joined exam ${examId}`);
    });

    // Student updates status (violations, answers progress)
    socket.on('student_update', (data) => {
      const { studentId, violationsCount, progress, status } = data;
      if (activeStudents.has(studentId)) {
        const student = activeStudents.get(studentId);
        student.violationsCount = violationsCount !== undefined ? violationsCount : student.violationsCount;
        student.progress = progress !== undefined ? progress : student.progress;
        student.status = status !== undefined ? status : student.status;
        student.lastActive = new Date();
        activeStudents.set(studentId, student);
        
        // Broadcast update to admins
        io.to('admins').emit('student_status_change', student);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      if (socket.studentId && activeStudents.has(socket.studentId)) {
        const student = activeStudents.get(socket.studentId);
        student.status = 'disconnected';
        student.lastActive = new Date();
        activeStudents.set(socket.studentId, student);
        
        io.to('admins').emit('student_status_change', student);
        
        // Remove after short delay if they don't reconnect
        setTimeout(() => {
          const current = activeStudents.get(socket.studentId);
          if (current && current.status === 'disconnected') {
            activeStudents.delete(socket.studentId);
            io.to('admins').emit('student_left', { studentId: socket.studentId });
          }
        }, 10000); // 10 seconds timeout
      }
    });
  });

  return io;
}

export function broadcastEvent(event, data) {
  if (io) {
    io.to('admins').emit(event, data);
  }
}

export function getActiveStudents() {
  return Array.from(activeStudents.values());
}
