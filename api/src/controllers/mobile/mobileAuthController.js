import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../../db/postgre.js';
import buildErrorResponse from '../../utils/errorResponse.js';
import {
  decryptString,
  encryptString,
  hmacSha256Hex,
  normalizeEmail,
  normalizePhoneBR,
  normalizeText,
} from '../../utils/fieldCrypto.js';
import { buildClaimsForUser, signAccessToken } from '../../utils/jwtHelpers.js';

dotenv.config();

const getPool = (req) => req.pool || pool;

function buildResetLink(token) {
  const base = (process.env.MOBILE_RESET_URL || process.env.FRONTEND_URL || 'http://localhost:3000').trim();
  if (!base) return null;

  if (base.includes('{token}')) {
    return base.replaceAll('{token}', encodeURIComponent(token));
  }

  const hasQuery = base.includes('?');
  const join = hasQuery ? '&' : '?';
  return `${base}${join}token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail(email, resetToken) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const resetUrl = buildResetLink(resetToken);
    const salonName = process.env.NOME_SALAO || 'Seu salão';

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `Redefinição de senha - ${salonName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Redefinição de Senha</h2>
          <p>Olá!</p>
          <p>Você solicitou a redefinição da sua senha no app de clientes do <strong>${salonName}</strong>.</p>
          <p>Clique no link abaixo para criar uma nova senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Redefinir Senha
            </a>
          </div>
          <p><strong>Este link é válido por 1 hora.</strong></p>
          <p>Se você não solicitou esta redefinição, ignore este email.</p>
          <p>Se o botão não funcionar, copie e cole este link no seu navegador:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">Este é um email automático, não responda a esta mensagem.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return false;
  }
}

async function findClientForLinking(db, { emailHash, phoneHash }) {
  if (!emailHash && !phoneHash) return null;

  if (emailHash) {
    const { rows } = await db.query('SELECT * FROM clients WHERE email_hash = $1 LIMIT 1', [emailHash]);
    if (rows.length) return rows[0];
  }
  if (phoneHash) {
    const { rows } = await db.query('SELECT * FROM clients WHERE phone_hash = $1 LIMIT 1', [phoneHash]);
    if (rows.length) return rows[0];
  }
  return null;
}

function decryptClientRow(row) {
  if (!row) return row;

  const email = row.email_enc ? decryptString(row.email_enc) : row.email;
  const phone = row.phone_enc ? decryptString(row.phone_enc) : row.phone;
  const address = row.address_enc ? decryptString(row.address_enc) : row.address;
  const birth_date = row.birth_date_enc ? decryptString(row.birth_date_enc) : row.birth_date;
  const notes = row.notes_enc ? decryptString(row.notes_enc) : row.notes;

  // eslint-disable-next-line no-unused-vars
  const { email_enc, phone_enc, address_enc, birth_date_enc, notes_enc, email_hash, phone_hash, ...rest } = row;
  return { ...rest, email, phone, address, birth_date, notes };
}

const MobileAuthController = {
  async register(req, res) {
    const db = getPool(req);
    try {
      const { email, password, name, phone, birth_date } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ message: 'Email, password and name are required' });
      }

      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const emailHash = hmacSha256Hex(normalizedEmail);

      const normalizedPhone = normalizePhoneBR(phone);
      const phoneHash = normalizedPhone ? hmacSha256Hex(normalizedPhone) : null;

      // Ensure user does not exist
      const { rows: existingRows } = await db.query('SELECT id FROM users WHERE email_hash = $1 LIMIT 1', [emailHash]);
      if (existingRows.length) {
        return res.status(409).json({ message: 'User already exists' });
      }

      const hashedPassword = bcrypt.hashSync(password, 8);
      const emailEnc = encryptString(normalizedEmail);

      // Create user as client (role forced)
      const { rows: userRows } = await db.query(
        `INSERT INTO users (email, email_enc, email_hash, password_hash, role)
         VALUES (NULL, $1, $2, $3, 'client')
         RETURNING id, role, email_enc, email`,
        [emailEnc, emailHash, hashedPassword]
      );
      const user = userRows[0];

      // Link to an existing client when possible (exact match)
      const candidate = await findClientForLinking(db, { emailHash, phoneHash });

      let clientRow;
      if (candidate) {
        if (candidate.user_id && candidate.user_id !== user.id) {
          return res.status(409).json({ message: 'Cliente já vinculado a outra conta' });
        }

        const phoneEnc = normalizedPhone ? encryptString(normalizedPhone) : candidate.phone_enc;
        const phoneHashFinal = phoneHash || candidate.phone_hash;
        const birthDateValue = birth_date ? String(birth_date) : null;
        const birthDateEnc = birthDateValue ? encryptString(birthDateValue) : candidate.birth_date_enc;

        const { rows } = await db.query(
          `UPDATE clients
           SET user_id = $1,
               name = COALESCE($2, name),
               email = NULL,
               email_enc = COALESCE($3, email_enc),
               email_hash = COALESCE($4, email_hash),
               phone = NULL,
               phone_enc = COALESCE($5, phone_enc),
               phone_hash = COALESCE($6, phone_hash),
               birth_date = NULL,
               birth_date_enc = COALESCE($7, birth_date_enc),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $8
           RETURNING *`,
          [
            user.id,
            normalizeText(name),
            emailEnc,
            emailHash,
            phoneEnc,
            phoneHashFinal,
            birthDateEnc,
            candidate.id,
          ]
        );
        clientRow = rows[0];
      } else {
        const birthDateValue = birth_date ? String(birth_date) : null;
        const phoneEnc = normalizedPhone ? encryptString(normalizedPhone) : null;
        const { rows } = await db.query(
          `INSERT INTO clients (
            user_id, name,
            email, phone, birth_date,
            email_enc, email_hash,
            phone_enc, phone_hash,
            birth_date_enc,
            first_visit, last_visit, total_visits, total_spent
          )
          VALUES (
            $1, $2,
            NULL, NULL, NULL,
            $3, $4,
            $5, $6,
            $7,
            NULL, NULL, 0, 0
          )
          RETURNING *`,
          [
            user.id,
            normalizeText(name) || name,
            emailEnc,
            emailHash,
            phoneEnc,
            phoneHash,
            birthDateValue ? encryptString(birthDateValue) : null,
          ]
        );
        clientRow = rows[0];
      }

      const claims = await buildClaimsForUser(db, { userId: user.id, role: 'client' });
      const token = signAccessToken(claims);

      return res.status(201).json({
        message: 'Client registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email_enc ? decryptString(user.email_enc) : user.email,
          role: 'client',
        },
        client: decryptClientRow(clientRow),
      });
    } catch (error) {
      console.error('Mobile register error:', error);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(error) });
    }
  },

  async login(req, res) {
    const db = getPool(req);
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      const emailHash = hmacSha256Hex(normalizedEmail);

      let user;
      {
        const { rows } = await db.query('SELECT * FROM users WHERE email_hash = $1 LIMIT 1', [emailHash]);
        user = rows[0];
      }
      if (!user) {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
        user = rows[0];
      }
      if (!user || user.role !== 'client') {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const claims = await buildClaimsForUser(db, { userId: user.id, role: user.role });
      if (!claims.client_id) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }
      const token = signAccessToken(claims);

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email_enc ? decryptString(user.email_enc) : user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Mobile login error:', error);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(error) });
    }
  },

  async forgotPassword(req, res) {
    const db = getPool(req);
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const emailHash = hmacSha256Hex(normalizedEmail);

      let user;
      {
        const { rows } = await db.query('SELECT * FROM users WHERE email_hash = $1 LIMIT 1', [emailHash]);
        user = rows[0];
      }
      if (!user) {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
        user = rows[0];
      }

      // Never reveal existence
      if (!user || user.role !== 'client') {
        return res.status(200).json({ message: 'Se o email existe no nosso sistema, você receberá um link de redefinição de senha.' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      const resetTokenHash = crypto.createHash('sha256').update(resetToken, 'utf8').digest('hex');

      await db.query(
        'UPDATE users SET reset_token = NULL, reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3',
        [resetTokenHash, resetTokenExpires, user.id]
      );

      const emailForSend = user.email_enc ? decryptString(user.email_enc) : normalizedEmail;
      const emailSent = await sendPasswordResetEmail(emailForSend, resetToken);
      if (!emailSent) {
        return res.status(500).json({ message: 'Error sending reset email' });
      }

      return res.status(200).json({ message: 'Se o email existe no nosso sistema, você receberá um link de redefinição de senha.' });
    } catch (error) {
      console.error('Mobile forgotPassword error:', error);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(error) });
    }
  },

  async resetPassword(req, res) {
    const db = getPool(req);
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
      const { rows } = await db.query(
        'SELECT * FROM users WHERE reset_token_hash = $1 AND reset_token_expires > NOW()',
        [tokenHash]
      );
      const user = rows[0];
      if (!user || user.role !== 'client') {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 8);
      await db.query(
        'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $2',
        [hashedPassword, user.id]
      );

      return res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Mobile resetPassword error:', error);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(error) });
    }
  },

  async validateResetToken(req, res) {
    const db = getPool(req);
    try {
      const { token } = req.params;
      const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
      const { rows } = await db.query(
        'SELECT id, role FROM users WHERE reset_token_hash = $1 AND reset_token_expires > NOW()',
        [tokenHash]
      );
      if (!rows.length || rows[0].role !== 'client') {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }
      return res.status(200).json({ message: 'Token is valid' });
    } catch (error) {
      console.error('Mobile validateResetToken error:', error);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(error) });
    }
  },
};

export default MobileAuthController;
