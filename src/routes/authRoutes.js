import express from 'express';
import authService from '../services/authService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route POST /auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Register user
    const newUser = await authService.register({ email, password, name });
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    });
  } catch (error) {
    console.error('Register route error:', error);
    if (error.message === 'User already exists') {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

/**
 * @route POST /auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Login user
    const authData = await authService.login({ email, password });
    
    res.status(200).json({
      message: 'Login successful',
      token: authData.token,
      user: authData.user,
    });
  } catch (error) {
    console.error('Login route error:', error);
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

/**
 * @route GET /auth/session
 * @desc Get user session
 * @access Private
 */
router.get('/session', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user session
    const user = await authService.getSession(userId);
    
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Session route error:', error);
    res.status(401).json({ message: 'Invalid session' });
  }
});

/**
 * @route POST /auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    
    // Logout user
    await authService.logout(token);
    
    res.status(200).json({
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout route error:', error);
    res.status(500).json({ message: 'Logout failed', error: error.message });
  }
});

export default router;