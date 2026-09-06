// server/src/routes/sessions.ts - 세션 통계 정확히 저장
import express from 'express';
import Session from '../models/Session';
import Detection from '../models/Detection';

const router = express.Router();

// 세션 시작
router.post('/start', async (req, res) => {
  try {
    const session = new Session(req.body);
    await session.save();
    console.log(`✅ Session started: ${session._id}`);
    res.status(201).json(session);
  } catch (error) {
    console.error('❌ Session start error:', error);
    res.status(500).json({ error: '세션 시작 실패' });
  }
});

// 🔥 핵심: 세션 종료 시 실제 집계 데이터 계산
router.put('/end/:sessionId', async (req, res) => {
  try {
    // 1. 해당 세션의 모든 detection 레코드 가져오기
    const detections = await Detection.find({ sessionId: req.params.sessionId });
    
    // 2. 실제 객체 수 집계
    const totalDetections = detections.reduce((sum, record) => {
      return sum + record.detections.length;
    }, 0);
    
    // 3. 클래스별 분포 계산
    const detectedClasses = new Map<string, number>();
    detections.forEach(record => {
      record.detections.forEach(det => {
        const currentCount = detectedClasses.get(det.class) || 0;
        detectedClasses.set(det.class, currentCount + 1);
      });
    });
    
    // 4. FPS, inferenceTime 평균 계산
    const avgFPS = detections.length > 0
      ? detections.reduce((sum, d) => sum + d.performance.fps, 0) / detections.length
      : 0;
    
    const avgInferenceTime = detections.length > 0
      ? detections.reduce((sum, d) => sum + d.performance.inferenceTime, 0) / detections.length
      : 0;
    
    // 5. 세션 업데이트
    const session = await Session.findByIdAndUpdate(
      req.params.sessionId,
      { 
        endTime: new Date(),
        totalDetections,      // ✅ 실제 집계된 객체 수
        avgFPS,
        avgInferenceTime,
        detectedClasses: Object.fromEntries(detectedClasses)
      },
      { new: true }
    );
    
    console.log(`🏁 Session ended: ${req.params.sessionId}`);
    console.log(`   - Total Detections: ${totalDetections}`);
    console.log(`   - Avg FPS: ${avgFPS.toFixed(2)}`);
    console.log(`   - Classes:`, Object.fromEntries(detectedClasses));
    
    res.json(session);
  } catch (error) {
    console.error('❌ Session end error:', error);
    res.status(500).json({ error: '세션 종료 실패' });
  }
});

// 모든 세션 조회
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find()
      .sort({ startTime: -1 })
      .limit(20);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: '조회 실패' });
  }
});

// 특정 세션 상세 조회
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없음' });
    }
    
    // Detection 레코드도 함께 조회
    const detections = await Detection.find({ sessionId: req.params.sessionId });
    
    res.json({
      session,
      detectionRecords: detections.length,
      totalObjects: detections.reduce((sum, d) => sum + d.detections.length, 0)
    });
  } catch (error) {
    res.status(500).json({ error: '조회 실패' });
  }
});

export default router;