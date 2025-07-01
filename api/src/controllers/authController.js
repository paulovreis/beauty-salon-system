import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

class AuthController {
    constructor(){}

    async login(req, res) {
        try{
            const { email, password } = req.body;
            const pool = req.pool;
            if (!pool) {
                return res.status(500).json({ message: 'Database connection not available' });
            }

            // Validate input
            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password are required' });
            }

            // Find user by email
            const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            const user = rows[0];
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Check password
            const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Generate JWT token
            const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

            return res.status(200).json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role
                }
            });
        }catch(error) {
            console.error('Login error:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    async register(req, res) {
        try {
            const { email, password, role } = req.body;
            const pool = req.pool;
            if (!pool) {
                return res.status(500).json({ message: 'Database connection not available' });
            }

            // Validate input
            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password are required' });
            }

            // Check if user already exists
            const { rows: existingRows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            if (existingRows.length > 0) {
                return res.status(409).json({ message: 'User already exists' });
            }

            // Hash password
            const hashedPassword = bcrypt.hashSync(password, 8);

            // Create new user
            const insertQuery = `
                INSERT INTO users (email, password_hash, role)
                VALUES ($1, $2, $3)
                RETURNING id, email, role
            `;
            const { rows: newUserRows } = await pool.query(insertQuery, [email, hashedPassword, role || 'employee']);
            const newUser = newUserRows[0];

            return res.status(201).json({
                message: 'User registered successfully',
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    role: newUser.role
                }
            });
        } catch (error) {
            console.error('Registration error:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    async refreshToken(req, res) {
        try {
            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) {
                return res.status(401).json({ message: 'Token is required' });
            }

            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(403).json({ message: 'Invalid token' });
                }

                const newToken = jwt.sign({ id: decoded.id, role: decoded.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

                return res.status(200).json({
                    message: 'Token refreshed successfully',
                    token: newToken
                });
            });
        } catch (error) {
            console.error('Refresh token error:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    async resetPassword(req, res) {
        try {
            const { email, newPassword } = req.body;
            const pool = req.pool;
            if (!pool) {
                return res.status(500).json({ message: 'Database connection not available' });
            }

            // Validate input
            if (!email || !newPassword) {
                return res.status(400).json({ message: 'Email and new password are required' });
            }

            // Find user by email
            const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            const user = rows[0];
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Hash new password
            const hashedPassword = bcrypt.hashSync(newPassword, 8);

            // Update password in database
            await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);

            return res.status(200).json({ message: 'Password reset successfully' });
        } catch (error) {
            console.error('Reset password error:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
}

export default AuthController;
