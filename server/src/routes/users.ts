// server/src/routes/users.ts
import express from 'express';
import UserService from '../services/UserService';

const router = express.Router();

// 모든 사용자 조회
router.get('/', async (req, res) => {
  try {
    const users = await UserService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: '사용자 조회 실패' });
  }
});

// 사용자 생성 (테스트용)
router.post('/', async (req, res) => {
  try {
    const user = await UserService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: '사용자 생성 실패' });
  }
});

export default router;