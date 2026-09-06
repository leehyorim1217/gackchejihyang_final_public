// server/src/routes/users.ts
import express from 'express';
import UserService from '../services/UserService';

const router = express.Router();

// 사용자 생성 (회원가입)
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, role } = req.body;
    
    // 입력 검증
    if (!email || !username || !password) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다' });
    }
    
    // 이메일 중복 확인
    const existingUser = await UserService.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: '이미 존재하는 이메일입니다' });
    }
    
    const user = await UserService.createUser({ email, username, password, role });
    res.status(201).json({ 
      message: '회원가입 성공', 
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });
    
  } catch (error: any) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ error: '회원가입 실패', details: error.message });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요' });
    }
    
    const user = await UserService.login({ email, password });
    
    if (!user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }
    
    res.json({ 
      message: '로그인 성공', 
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        last_login: user.last_login
      }
    });
    
  } catch (error: any) {
    console.error('로그인 오류:', error);
    res.status(500).json({ error: '로그인 실패', details: error.message });
  }
});

// 사용자 조회 (ID)
router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '유효하지 않은 사용자 ID입니다' });
    }
    
    const user = await UserService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
    
    res.json(user);
    
  } catch (error: any) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({ error: '조회 실패', details: error.message });
  }
});

// 모든 사용자 조회
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const users = await UserService.getAllUsers(limit, offset);
    res.json({ users, count: users.length });
    
  } catch (error: any) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({ error: '조회 실패', details: error.message });
  }
});

// 사용자 정보 수정
router.put('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '유효하지 않은 사용자 ID입니다' });
    }
    
    const updates = req.body;
    const user = await UserService.updateUser(userId, updates);
    
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
    
    res.json({ message: '업데이트 성공', user });
    
  } catch (error: any) {
    console.error('사용자 업데이트 오류:', error);
    res.status(500).json({ error: '업데이트 실패', details: error.message });
  }
});

// 사용자 삭제
router.delete('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '유효하지 않은 사용자 ID입니다' });
    }
    
    const success = await UserService.deleteUser(userId);
    
    if (!success) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
    
    res.json({ message: '삭제 성공' });
    
  } catch (error: any) {
    console.error('사용자 삭제 오류:', error);
    res.status(500).json({ error: '삭제 실패', details: error.message });
  }
});

// 사용자 통계 조회
router.get('/:userId/stats', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '유효하지 않은 사용자 ID입니다' });
    }
    
    const stats = await UserService.getUserStats(userId);
    res.json(stats);
    
  } catch (error: any) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({ error: '조회 실패', details: error.message });
  }
});

export default router;