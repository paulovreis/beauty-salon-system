import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

dotenv.config();

// Função auxiliar para enviar email
async function sendPasswordResetEmail(email, resetToken) {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`;
        
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Redefinição de Senha - Sistema de Salão de Beleza',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Redefinição de Senha</h2>
                    <p>Olá!</p>
                    <p>Você solicitou a redefinição da sua senha no sistema do Salão Fada Madrinha.</p>
                    <p>Clique no link abaixo para criar uma nova senha:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}?token=${resetToken}" 
                           style="background-color: #007bff; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Redefinir Senha
                        </a>
                    </div>
                    <p><strong>Este link é válido por 1 hora.</strong></p>
                    <p>Se você não solicitou esta redefinição, ignore este email.</p>
                    <p>Se o botão não funcionar, copie e cole este link no seu navegador:</p>
                    <p style="word-break: break-all; color: #666;">${resetUrl}?token=${resetToken}</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 12px;">
                        Este é um email automático, não responda a esta mensagem.
                    </p>
                </div>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email de reset enviado:', result.messageId);
        return true;
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        return false;
    }
}

class AuthController {
    constructor(){}

    async login(req, res) {
        try{
            const { email, password } = req.body;
            const pool = req.pool;
            if (!pool) {
                return res.status(500).json({ message: 'Database connection not available' });
            }

            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password are required' });
            }

            const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            const user = rows[0];
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

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

            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password are required' });
            }

            const { rows: existingRows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            if (existingRows.length > 0) {
                return res.status(409).json({ message: 'User already exists' });
            }

            const hashedPassword = bcrypt.hashSync(password, 8);

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

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
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
                return res.status(200).json({ 
                    message: 'Se o email existe no nosso sistema, você receberá um link de redefinição de senha.' 
                });
            }

            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

            await pool.query(
                'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
                [resetToken, resetTokenExpires, email]
            );

            const emailSent = await sendPasswordResetEmail(email, resetToken);
            if (!emailSent) {
                return res.status(500).json({ message: 'Error sending reset email' });
            }

            return res.status(200).json({ 
                message: 'Se o email existe no nosso sistema, você receberá um link de redefinição de senha.' 
            });
        } catch (error) {
            console.error('Forgot password error:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            const pool = req.pool;
            if (!pool) {
                return res.status(500).json({ message: 'Database connection not available' });
            }

            if (!token || !newPassword) {
                return res.status(400).json({ message: 'Token and new password are required' });
            }

            const { rows } = await pool.query(
                'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
                [token]
            );
            
            const user = rows[0];
            if (!user) {
                return res.status(400).json({ message: 'Invalid or expired reset token' });
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

    async validateResetToken(req, res) {
        try {
            const { token } = req.params;
            const pool = req.pool;
            if (!pool) {
                return res.status(500).json({ message: 'Database connection not available' });
            }

            const { rows } = await pool.query(
                'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
                [token]
            );
            
            if (rows.length === 0) {
                return res.status(400).json({ message: 'Invalid or expired reset token' });
            }

            return res.status(200).json({ message: 'Token is valid' });
        } catch (error) {
            console.error('Validate reset token error:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
}

export default AuthController;