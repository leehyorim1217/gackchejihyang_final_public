// server/src/routes/detections.ts - 완전한 CRUD 버전
import express from 'express';
import Detection from '../models/Detection';

const router = express.Router();

// 🔥 전체 Detection 조회 (AdminDashboard용)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const detections = await Detection.find()
      .sort({ timestamp: -1 })
      .limit(limit);
    
    console.log(`📋 Retrieved ${detections.length} detection records`);
    res.json(detections);
  } catch (error) {
    console.error('❌ Detection fetch error:', error);
    res.status(500).json({ error: '조회 실패' });
  }
});

// Detection 저장
router.post('/', async (req, res) => {
  try {
    const detection = new Detection(req.body);
    await detection.save();
    
    console.log(`💾 Saved detection with ${detection.detections.length} objects`);
    
    res.status(201).json(detection);
  } catch (error) {
    console.error('❌ Detection save error:', error);
    res.status(500).json({ error: '탐지 저장 실패' });
  }
});

// 세션별 Detection 조회
router.get('/session/:sessionId', async (req, res) => {
  try {
    const detections = await Detection.find({ 
      sessionId: req.params.sessionId 
    }).sort({ timestamp: -1 });
    res.json(detections);
  } catch (error) {
    res.status(500).json({ error: '조회 실패' });
  }
});

// 세션별 통계
router.get('/stats/:sessionId', async (req, res) => {
  try {
    const detections = await Detection.find({ 
      sessionId: req.params.sessionId 
    });

    if (detections.length === 0) {
      return res.json({
        totalDetections: 0,
        totalRecords: 0,
        avgFPS: 0,
        avgInferenceTime: 0,
        classDistribution: {}
      });
    }

    const totalDetections = detections.reduce((sum, record) => {
      return sum + record.detections.length;
    }, 0);

    const avgFPS = detections.reduce((sum, d) => sum + d.performance.fps, 0) / detections.length;
    const avgInferenceTime = detections.reduce((sum, d) => sum + d.performance.inferenceTime, 0) / detections.length;

    const classDistribution: Record<string, number> = {};
    
    detections.forEach(record => {
      record.detections.forEach(det => {
        if (!classDistribution[det.class]) {
          classDistribution[det.class] = 0;
        }
        classDistribution[det.class]++;
      });
    });

    const stats = {
      totalDetections,
      totalRecords: detections.length,
      avgFPS,
      avgInferenceTime,
      classDistribution
    };

    console.log(`📊 Stats for session ${req.params.sessionId}:`);
    console.log(`   - Total Records: ${stats.totalRecords}`);
    console.log(`   - Total Detections: ${stats.totalDetections}`);

    res.json(stats);
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

// 🔥 전체 Detections 삭제 (먼저 선언)
router.delete('/all', async (req, res) => {
  try {
    const result = await Detection.deleteMany({});
    
    console.log(`🗑️ Deleted all detections: ${result.deletedCount} records`);
    res.json({ 
      message: '전체 삭제 성공', 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('❌ Delete all detections error:', error);
    res.status(500).json({ error: '전체 삭제 실패' });
  }
});

// 🔥 개별 Detection 삭제
router.delete('/:detectionId', async (req, res) => {
  try {
    const result = await Detection.findByIdAndDelete(req.params.detectionId);
    
    if (!result) {
      return res.status(404).json({ error: 'Detection을 찾을 수 없습니다' });
    }
    
    console.log(`🗑️ Deleted detection: ${req.params.detectionId}`);
    res.json({ message: '삭제 성공', deletedId: req.params.detectionId });
  } catch (error) {
    console.error('❌ Detection delete error:', error);
    res.status(500).json({ error: '삭제 실패' });
  }
});

export default router;