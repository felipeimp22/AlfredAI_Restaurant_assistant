// src/services/authService.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import pg from 'pg';
const { Pool } = pg;

// Create PostgreSQL connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'restaurant',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: Number(process.env.POSTGRES_PORT) || 5432,
});

// JWT Secret for token generation and verification
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-token-with-at-least-32-characters';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Helper to log db queries for debugging
const logQuery = (text, params) => {
  console.log('Executing query:', { text, params });
};

const authService = {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} - New user data
   */
  async register({ email, password, name }) {
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      logQuery('BEGIN transaction');
      
      // Check if user already exists in auth.users
      const existingUserQuery = 'SELECT * FROM auth.users WHERE email = $1';
      logQuery(existingUserQuery, [email]);
      const existingUserResult = await client.query(existingUserQuery, [email]);
      
      if (existingUserResult.rows.length > 0) {
        throw new Error('User already exists');
      }
      
      // Generate UUID for new user
      const userIdQuery = 'SELECT uuid_generate_v4() as id';
      logQuery(userIdQuery);
      const userIdResult = await client.query(userIdQuery);
      const userId = userIdResult.rows[0].id;
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insert user into auth.users - NOTE: removed confirmed_at to fix the error
      const insertAuthUserQuery = `
        INSERT INTO auth.users (
          id, email, encrypted_password, role, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data
        ) 
        VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6)
        RETURNING id, email, role
      `;
      
      const appMetaData = { provider: 'email' };
      const userMetaData = { name };
      
      logQuery(insertAuthUserQuery, [userId, email, hashedPassword, 'authenticated', appMetaData, userMetaData]);
      
      const userResult = await client.query(insertAuthUserQuery, [
        userId, 
        email, 
        hashedPassword, 
        'authenticated',
        JSON.stringify(appMetaData),
        JSON.stringify(userMetaData)
      ]);
      
      // Also create a customer record for the user
      const insertCustomerQuery = `
        INSERT INTO restaurant.customers (id, name, email, visits, created_at) 
        VALUES ($1, $2, $3, 0, NOW())
        RETURNING id, name, email
      `;
      
      logQuery(insertCustomerQuery, [userId, name, email]);
      await client.query(insertCustomerQuery, [userId, name, email]);
      
      // Commit transaction
      await client.query('COMMIT');
      logQuery('COMMIT transaction');
      
      return {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        name,
        role: userResult.rows[0].role
      };
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      logQuery('ROLLBACK transaction');
      
      console.error('Registration error:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Login user
   * @param {Object} credentials - User credentials
   * @returns {Promise<Object>} - Auth token and user data
   */
  async login({ email, password }) {
    try {
      // Get user from auth.users
      const query = `
        SELECT u.id, u.email, u.encrypted_password, u.role, 
               (u.raw_user_meta_data->>'name') as name
        FROM auth.users u
        WHERE u.email = $1
      `;
      
      logQuery(query, [email]);
      const result = await pool.query(query, [email]);

      if (result.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = result.rows[0];
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.encrypted_password);
      
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          name: user.name 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      // Update last sign in time
      const updateQuery = `
        UPDATE auth.users 
        SET last_sign_in_at = NOW(), updated_at = NOW() 
        WHERE id = $1
      `;
      
      logQuery(updateQuery, [user.id]);
      await pool.query(updateQuery, [user.id]);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  /**
   * Validate JWT token
   * @param {string} token - JWT token
   * @returns {Promise<Object>} - Decoded token
   */
  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded;
    } catch (error) {
      console.error('Token validation error:', error);
      throw new Error('Invalid token');
    }
  },

  /**
   * Get user session
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User data
   */
  async getSession(userId) {
    try {
      // Get user data using the auth.users table
      const query = `
        SELECT u.id, u.email, u.role, 
               (u.raw_user_meta_data->>'name') as name
        FROM auth.users u
        WHERE u.id = $1
      `;
      
      logQuery(query, [userId]);
      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
        role: result.rows[0].role
      };
    } catch (error) {
      console.error('Get session error:', error);
      throw error;
    }
  },

  /**
   * Logout user
   * @param {string} token - JWT token
   * @returns {Promise<boolean>} - Success flag
   */
  async logout(token) {
    try {
      // Verify token first
      const decoded = await this.validateToken(token);
      
      // Note: In a full implementation, we might add the token to a blacklist
      // For now, just return success as JWT is stateless
      console.log('User logged out:', decoded.id);
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
};

export default authService;