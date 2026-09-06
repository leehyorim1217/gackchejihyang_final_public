// server/src/index.ts - 완전한 버전 (모든 Detections API 포함)

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-portfolio';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB 연결 성공');
    console.log(`📊 Database: ${MONGODB_URI}`);
  })
  .catch((err) => {
    console.error('❌ MongoDB 연결 실패:', err);
    process.exit(1);
  });

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'AI Portfolio API Server',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================
// Users API
// ============================================
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const users = [
      {
        _id: 'demo-user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        createdAt: new Date(),
        sessionsCount: 5
      }
    ];
    res.json(users);
  } catch (error) {
    console.error('❌ Users fetch error:', error);
    res.status(500).json({ error: '사용자 조회 실패' });
  }
});

// ============================================
// Sessions API
// ============================================

// 세션 시작
app.post('/api/sessions/start', async (req: Request, res: Response) => {
  try {
    const { Session } = await import('./models/Session.js');
    const session = new Session(req.body);
    await session.save();
    console.log(`✅ Session started: ${session._id}`);
    res.status(201).json(session);
  } catch (error) {
    console.error('❌ Session start error:', error);
    res.status(500).json({ error: '세션 시작 실패' });
  }
});

// 세션 종료
app.put('/api/sessions/end/:sessionId', async (req: Request, res: Response) => {
  try {
    const { Session } = await import('./models/Session.js');
    
    const totalDetections = Number(req.body.totalDetections) || 0;
    const avgFPS = Number(req.body.avgFPS) || 0;
    const avgInferenceTime = Number(req.body.avgInferenceTime) || 0;
    
    const safeTotalDetections = isNaN(totalDetections) ? 0 : totalDetections;
    const safeAvgFPS = isNaN(avgFPS) ? 0 : avgFPS;
    const safeAvgInferenceTime = isNaN(avgInferenceTime) ? 0 : avgInferenceTime;
    
    const session = await Session.findByIdAndUpdate(
      req.params.sessionId,
      { 
        endTime: new Date(), 
        totalDetections: safeTotalDetections,
        avgFPS: safeAvgFPS,
        avgInferenceTime: safeAvgInferenceTime
      },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }
    
    console.log(`✅ Session ended: ${req.params.sessionId}`);
    res.json(session);
  } catch (error) {
    console.error('❌ Session end error:', error);
    res.status(500).json({ error: '세션 종료 실패' });
  }
});

// 세션 목록 조회
app.get('/api/sessions', async (req: Request, res: Response) => {
  try {
    const { Session } = await import('./models/Session.js');
    const sessions = await Session.find()
      .sort({ startTime: -1 })
      .limit(50);
    res.json(sessions);
  } catch (error) {
    console.error('❌ Sessions fetch error:', error);
    res.status(500).json({ error: '조회 실패' });
  }
});

// 개별 세션 삭제
app.delete('/api/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { Session } = await import('./models/Session.js');
    const { Detection } = await import('./models/Detection.js');
    
    const sessionId = req.params.sessionId;
    console.log(`🗑️ Deleting session: ${sessionId}`);
    
    const deletedSession = await Session.findByIdAndDelete(sessionId);
    if (!deletedSession) {
      console.log(`⚠️ Session not found: ${sessionId}`);
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }
    
    const deletedDetections = await Detection.deleteMany({ sessionId });
    
    console.log(`✅ Deleted session: ${sessionId} (${deletedDetections.deletedCount} detections removed)`);
    
    res.json({ 
      success: true,
      deletedSession,
      deletedDetections: deletedDetections.deletedCount
    });
  } catch (error) {
    console.error('❌ Session delete error:', error);
    res.status(500).json({ error: '세션 삭제 실패' });
  }
});

// 전체 세션 삭제
app.delete('/api/sessions', async (req: Request, res: Response) => {
  try {
    const { Session } = await import('./models/Session.js');
    const { Detection } = await import('./models/Detection.js');
    
    console.log('🗑️ Deleting all sessions...');
    
    const deletedSessions = await Session.deleteMany({});
    const deletedDetections = await Detection.deleteMany({});
    
    console.log(`✅ All deleted: ${deletedSessions.deletedCount} sessions, ${deletedDetections.deletedCount} detections`);
    
    res.json({ 
      success: true,
      deletedSessions: deletedSessions.deletedCount,
      deletedDetections: deletedDetections.deletedCount
    });
  } catch (error) {
    console.error('❌ Delete all error:', error);
    res.status(500).json({ error: '전체 삭제 실패' });
  }
});

// ============================================
// Detections API
// ============================================

// 🔥 전체 Detection 조회 (AdminDashboard용) - 먼저 선언
app.get('/api/detections', async (req: Request, res: Response) => {
  try {
    const { Detection } = await import('./models/Detection.js');
    const limit = parseInt(req.query.limit as string) || 50;
    
    const detections = await Detection.find()
      .sort({ timestamp: -1 })
      .limit(limit);
    
    console.log(`📋 Retrieved ${detections.length} detection records`);
    res.json(detections);
  } catch (error) {
    console.error('❌ Detections fetch error:', error);
    res.status(500).json({ error: '조회 실패' });
  }
});

// 🔥 전체 Detections 삭제
app.delete('/api/detections/all', async (req: Request, res: Response) => {
  try {
    const { Detection } = await import('./models/Detection.js');
    
    console.log('🗑️ Deleting all detections...');
    const result = await Detection.deleteMany({});
    
    console.log(`✅ Deleted all detections: ${result.deletedCount} records`);
    res.json({ 
      success: true,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('❌ Delete all detections error:', error);
    res.status(500).json({ error: '전체 삭제 실패' });
  }
});

// Detection 저장
app.post('/api/detections', async (req: Request, res: Response) => {
  try {
    const { Detection } = await import('./models/Detection.js');
    
    if (!req.body.sessionId) {
      return res.status(400).json({ error: 'sessionId가 필요합니다' });
    }
    
    const detection = new Detection(req.body);
    await detection.save();
    
    console.log(`✅ Detection saved: ${detection.detections.length} objects in session ${detection.sessionId}`);
    res.status(201).json(detection);
  } catch (error) {
    console.error('❌ Detection save error:', error);
    res.status(500).json({ error: '탐지 저장 실패' });
  }
});

// Session별 Detection 조회
app.get('/api/detections/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { Detection } = await import('./models/Detection.js');
    const detections = await Detection.find({ 
      sessionId: req.params.sessionId 
    }).sort({ timestamp: -1 });
    
    res.json(detections);
  } catch (error) {
    console.error('❌ Detections fetch error:', error);
    res.status(500).json({ error: '조회 실패' });
  }
});

// Session 통계 조회
app.get('/api/detections/stats/:sessionId', async (req: Request, res: Response) => {
  try {
    const { Detection } = await import('./models/Detection.js');
    const detections = await Detection.find({ 
      sessionId: req.params.sessionId 
    });

    if (detections.length === 0) {
      return res.json({
        totalDetections: 0,
        avgFPS: 0,
        avgInferenceTime: 0,
        classDistribution: {}
      });
    }

    const stats = {
      totalDetections: detections.length,
      avgFPS: detections.reduce((sum, d) => sum + d.performance.fps, 0) / detections.length,
      avgInferenceTime: detections.reduce((sum, d) => sum + d.performance.inferenceTime, 0) / detections.length,
      classDistribution: {} as Record<string, number>
    };

    detections.forEach(d => {
      d.detections.forEach(det => {
        if (!stats.classDistribution[det.class]) {
          stats.classDistribution[det.class] = 0;
        }
        stats.classDistribution[det.class]++;
      });
    });

    res.json(stats);
  } catch (error) {
    console.error('❌ Stats fetch error:', error);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

// 🔥 개별 Detection 삭제
app.delete('/api/detections/:detectionId', async (req: Request, res: Response) => {
  try {
    const { Detection } = await import('./models/Detection.js');
    
    const result = await Detection.findByIdAndDelete(req.params.detectionId);
    
    if (!result) {
      return res.status(404).json({ error: 'Detection을 찾을 수 없습니다' });
    }
    
    console.log(`🗑️ Deleted detection: ${req.params.detectionId}`);
    res.json({ 
      success: true,
      deletedId: req.params.detectionId 
    });
  } catch (error) {
    console.error('❌ Detection delete error:', error);
    res.status(500).json({ error: '삭제 실패' });
  }
});

// ============================================
// Admin Dashboard Statistics
// ============================================
app.get('/api/admin/stats', async (req: Request, res: Response) => {
  try {
    const { Session } = await import('./models/Session.js');
    const { Detection } = await import('./models/Detection.js');

    const [totalSessions, totalDetections] = await Promise.all([
      Session.countDocuments(),
      Detection.countDocuments()
    ]);

    const recentSessions = await Session.find()
      .sort({ startTime: -1 })
      .limit(10);

    res.json({
      totalSessions,
      totalDetections,
      totalUsers: 1,
      recentSessions
    });
  } catch (error) {
    console.error('❌ Admin stats error:', error);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use((req: Request, res: Response) => {
  console.log(`⚠️ 404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Server Error:', err);
  
  res.status(err.status || 500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ============================================
// Server Start
// ============================================
const server = app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 AI Portfolio Server Started`);
  console.log('='.repeat(60));
  console.log(`📍 URL:          http://localhost:${PORT}`);
  console.log(`📊 Environment:  ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  MongoDB:      ${MONGODB_URI}`);
  console.log('='.repeat(60));
  console.log('📌 Available Endpoints:');
  console.log('  GET    /health');
  console.log('  GET    /api/users');
  console.log('  POST   /api/sessions/start');
  console.log('  PUT    /api/sessions/end/:sessionId');
  console.log('  GET    /api/sessions');
  console.log('  DELETE /api/sessions/:sessionId');
  console.log('  DELETE /api/sessions');
  console.log('  GET    /api/detections                    ✅ NEW');
  console.log('  POST   /api/detections');
  console.log('  DELETE /api/detections/all                ✅ NEW');
  console.log('  DELETE /api/detections/:detectionId       ✅ NEW');
  console.log('  GET    /api/detections/session/:sessionId');
  console.log('  GET    /api/detections/stats/:sessionId');
  console.log('  GET    /api/admin/stats');
  console.log('='.repeat(60));
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n👋 ${signal} received, shutting down...`);
  
  server.close(() => {
    mongoose.connection.close()
      .then(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });

  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));