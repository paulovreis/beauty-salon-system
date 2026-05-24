import pool from "../db/postgre.js";
import whatsappService from "../services/whatsappNotificationService.js";
import buildErrorResponse from '../utils/errorResponse.js';
import {
  decryptString,
  encryptString,
  hmacSha256Hex,
  normalizeEmail,
  normalizePhoneBR,
  normalizeText,
} from '../utils/fieldCrypto.js';

// Permite usar req.pool (injetado via middleware) ou pool padrão
const getPool = (req) => req.pool || pool;

function decryptClientRow(row) {
  if (!row) return row;

  const email = row.email_enc ? decryptString(row.email_enc) : row.email;
  const phone = row.phone_enc ? decryptString(row.phone_enc) : row.phone;
  const address = row.address_enc ? decryptString(row.address_enc) : row.address;
  const birth_date = row.birth_date_enc ? decryptString(row.birth_date_enc) : row.birth_date;
  const notes = row.notes_enc ? decryptString(row.notes_enc) : row.notes;

  // Do not expose encrypted payloads/hashes by default.
  // Keep birth_month/birth_day since they are derived and non-sensitive.
  // eslint-disable-next-line no-unused-vars
  const { email_enc, phone_enc, address_enc, birth_date_enc, notes_enc, email_hash, phone_hash, reset_token_hash, ...rest } = row;
  return { ...rest, email, phone, address, birth_date, notes };
}

function deriveBirthParts(birthDateValue) {
  if (!birthDateValue) return { birth_month: null, birth_day: null };
  const d = new Date(birthDateValue);
  if (Number.isNaN(d.getTime())) return { birth_month: null, birth_day: null };
  return { birth_month: d.getUTCMonth() + 1, birth_day: d.getUTCDate() };
}

class ClientController {
  async list(req, res) {
    const db = getPool(req);
    try {
      const { q } = req.query;
      const pagination = req.pagination || {
        page: Number.parseInt(req.query.page, 10) || 1,
        limit: Number.parseInt(req.query.limit, 10) || 50,
      };
      const page = pagination.page;
      const limit = pagination.limit;
      const offset = pagination.offset ?? (page - 1) * limit;
      
      let query = `
        SELECT 
          c.id, c.name,
          c.email_enc, c.phone_enc, c.address_enc, c.birth_date_enc, c.notes_enc,
          c.birth_month, c.birth_day,
          c.first_visit, c.last_visit, c.total_visits, 
          c.total_spent, c.created_at, c.updated_at,
          COUNT(a.id) as upcoming_appointments
        FROM clients c
        LEFT JOIN appointments a ON c.id = a.client_id AND a.appointment_date >= CURRENT_DATE AND a.status = 'scheduled'
      `;
      let countQuery = 'SELECT COUNT(*) FROM clients c';
      let params = [];
      let whereClause = '';
      
      if (q) {
        const qText = String(q);
        const qLike = `%${qText}%`;
        const emailHash = qText.includes('@') ? hmacSha256Hex(normalizeEmail(qText)) : null;
        const phoneHash = /\d/.test(qText) ? hmacSha256Hex(normalizePhoneBR(qText)) : null;

        // Exact match for email/phone via hash; keep partial match for name only.
        whereClause = ' WHERE (unaccent(lower(c.name)) LIKE unaccent(lower($1))'
          + (phoneHash ? ' OR c.phone_hash = $2' : '')
          + (emailHash ? ` OR c.email_hash = $${phoneHash ? 3 : 2}` : '')
          + ')';

        params = [qLike];
        if (phoneHash) params.push(phoneHash);
        if (emailHash) params.push(emailHash);
        countQuery += whereClause;
      }
      
      query += whereClause + ' GROUP BY c.id ORDER BY c.name LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      
      if (q && limit <= 20) {
        // Para busca rápida, retorna só dados básicos
        const qText = String(q);
        const qLike = `%${qText}%`;
        const emailHash = qText.includes('@') ? hmacSha256Hex(normalizeEmail(qText)) : null;
        const phoneHash = /\d/.test(qText) ? hmacSha256Hex(normalizePhoneBR(qText)) : null;

        const conditions = ['unaccent(lower(name)) LIKE unaccent(lower($1))'];
        const paramsQuick = [qLike];
        let idx = 2;
        if (phoneHash) {
          conditions.push(`phone_hash = $${idx}`);
          paramsQuick.push(phoneHash);
          idx++;
        }
        if (emailHash) {
          conditions.push(`email_hash = $${idx}`);
          paramsQuick.push(emailHash);
          idx++;
        }

        const { rows } = await db.query(
          `SELECT id, name, phone_enc, email_enc FROM clients WHERE (${conditions.join(' OR ')}) ORDER BY name LIMIT 20`,
          paramsQuick
        );
        return res.json(rows.map(decryptClientRow));
      }
      
      const [clientsResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, params.length ? params.slice(0, params.length - 2) : [])
      ]);
      
      res.json({
        clients: clientsResult.rows.map(decryptClientRow),
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].count),
          totalPages: Math.ceil(countResult.rows[0].count / limit)
        }
      });
    } catch (err) {
      console.error('Erro ao listar clientes:', err);
      res.status(500).json({ message: 'Erro ao listar clientes', ...buildErrorResponse(err) });
    }
  }

  async getById(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    try {
      const clientQuery = `
        SELECT 
          c.id, c.name,
          c.email_enc, c.phone_enc, c.address_enc, c.birth_date_enc, c.notes_enc,
          c.birth_month, c.birth_day,
          c.first_visit, c.last_visit, c.total_visits, c.total_spent, c.created_at, c.updated_at,
          COUNT(DISTINCT a.id) as total_appointments,
          COUNT(DISTINCT CASE WHEN a.appointment_date >= CURRENT_DATE AND a.status = 'scheduled' THEN a.id END) as upcoming_appointments,
          MAX(a.appointment_date) as last_appointment_date,
          AVG(a.price) as average_service_price
        FROM clients c
        LEFT JOIN appointments a ON c.id = a.client_id
        WHERE c.id = $1
        GROUP BY c.id
      `;
      
      const appointmentsQuery = `
        SELECT 
          a.id, a.appointment_date, a.appointment_time, a.status, a.price, a.notes, a.notes_enc,
          s.name as service_name, e.name as employee_name
        FROM appointments a
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.client_id = $1
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
        LIMIT 10
      `;
      
      const [clientResult, appointmentsResult] = await Promise.all([
        db.query(clientQuery, [id]),
        db.query(appointmentsQuery, [id])
      ]);
      
      if (clientResult.rows.length === 0) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }
      
      res.json({
        ...decryptClientRow(clientResult.rows[0]),
        recent_appointments: appointmentsResult.rows.map((r) => {
          const notes = r.notes_enc ? decryptString(r.notes_enc) : r.notes;
          // eslint-disable-next-line no-unused-vars
          const { notes_enc, ...rest } = r;
          return { ...rest, notes };
        }),
      });
    } catch (err) {
      console.error('Erro ao buscar cliente:', err);
      res.status(500).json({ message: 'Erro ao buscar cliente', ...buildErrorResponse(err) });
    }
  }

  async create(req, res) {
    const db = getPool(req);
    const { name, email, phone, address, birth_date, notes } = req.body;
    
    if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });
    
    try {
      const normalizedEmail = normalizeEmail(email);
      const normalizedPhone = normalizePhoneBR(phone);
      const normalizedAddress = normalizeText(address);
      const normalizedNotes = normalizeText(notes);
      const birthDateValue = birth_date ? String(birth_date) : null;

      const emailHash = normalizedEmail ? hmacSha256Hex(normalizedEmail) : null;
      const phoneHash = normalizedPhone ? hmacSha256Hex(normalizedPhone) : null;

      const emailEnc = normalizedEmail ? encryptString(normalizedEmail) : null;
      const phoneEnc = normalizedPhone ? encryptString(normalizedPhone) : null;
      const addressEnc = normalizedAddress ? encryptString(normalizedAddress) : null;
      const notesEnc = normalizedNotes ? encryptString(normalizedNotes) : null;
      const birthDateEnc = birthDateValue ? encryptString(birthDateValue) : null;
      const { birth_month, birth_day } = deriveBirthParts(birthDateValue);

      // Verifica se já existe cliente com o mesmo telefone ou email (exato via hash)
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (phoneHash) {
        conditions.push(`phone_hash = $${paramIndex}`);
        params.push(phoneHash);
        paramIndex++;
      }
      
      if (emailHash) {
        conditions.push(`email_hash = $${paramIndex}`);
        params.push(emailHash);
        paramIndex++;
      }
      
      if (conditions.length > 0) {
        const existing = await db.query(
          `SELECT id, name FROM clients WHERE ${conditions.join(' OR ')} LIMIT 1`, 
          params
        );
        
        if (existing.rows.length) {
          return res.status(409).json({ 
            message: 'Cliente já existe com este telefone ou email', 
            existing_client: existing.rows[0] 
          });
        }
      }
      
      const { rows } = await db.query(
        `INSERT INTO clients (
            name,
            email, phone, address, birth_date, notes,
            email_enc, email_hash,
            phone_enc, phone_hash,
            address_enc,
            birth_date_enc, birth_month, birth_day,
            notes_enc,
            first_visit, last_visit, created_at, updated_at
         ) 
         VALUES (
            $1,
            NULL, NULL, NULL, NULL, NULL,
            $2, $3,
            $4, $5,
            $6,
            $7, $8, $9,
            $10,
            CURRENT_DATE, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         ) 
         RETURNING *`,
        [name, emailEnc, emailHash, phoneEnc, phoneHash, addressEnc, birthDateEnc, birth_month, birth_day, notesEnc]
      );
      
      const newClient = decryptClientRow(rows[0]);
      
      // Enviar mensagem de boas-vindas via WhatsApp se o cliente tiver telefone
      if (newClient.phone) {
        try {
          const welcomeMessage = `🎉 *Bem-vindo(a), ${name}!*\n\nOlá! É um prazer ter você como nosso cliente!\n\nEstamos aqui para cuidar da sua beleza com todo carinho e profissionalismo.\n\n✨ *Nossos serviços incluem:*\n• Cortes e penteados\n• Coloração e mechas\n• Tratamentos capilares\n• Manicure e pedicure\n• E muito mais!\n\n📅 Para agendamentos, entre em contato conosco!\n\n💖 Obrigada por escolher nosso salão!`;
          
          await whatsappService.sendMessage(newClient.phone, welcomeMessage);
        } catch (whatsappError) {
          console.error('Erro ao enviar mensagem de boas-vindas:', whatsappError);
          // Não falha a criação do cliente se a mensagem falhar
        }
      }
      
      // Notificar gerentes/donos sobre novo cliente
      try {
        await whatsappService.sendSystemChangeNotification(
          'client_created',
          {
            name: name,
            phone: newClient.phone || 'Não informado',
            email: newClient.email || 'Não informado',
            address: newClient.address || 'Não informado'
          },
          `Novo Cliente: ${name}`
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de novo cliente:', notificationError);
      }
      
      res.status(201).json(newClient);
    } catch (err) {
      console.error('Erro ao criar cliente:', err);
      res.status(500).json({ message: 'Erro ao criar cliente', ...buildErrorResponse(err) });
    }
  }

  async update(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    const { name, email, phone, address, birth_date, notes } = req.body;
    
    if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });
    
    try {
      // Buscar dados atuais para comparação
      const currentResult = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
      const currentRow = currentResult.rows[0];
      const currentClient = decryptClientRow(currentRow);
      
      if (!currentClient) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }

      // Verifica se existe outro cliente com o mesmo telefone ou email
      const hasEmail = Object.prototype.hasOwnProperty.call(req.body, 'email');
      const hasPhone = Object.prototype.hasOwnProperty.call(req.body, 'phone');
      const hasAddress = Object.prototype.hasOwnProperty.call(req.body, 'address');
      const hasBirthDate = Object.prototype.hasOwnProperty.call(req.body, 'birth_date');
      const hasNotes = Object.prototype.hasOwnProperty.call(req.body, 'notes');

      const normalizedEmail = hasEmail ? normalizeEmail(email) : null;
      const normalizedPhone = hasPhone ? normalizePhoneBR(phone) : null;
      const normalizedAddress = hasAddress ? normalizeText(address) : null;
      const normalizedNotes = hasNotes ? normalizeText(notes) : null;
      const birthDateValue = hasBirthDate && birth_date ? String(birth_date) : (hasBirthDate ? null : null);

      const legacyEmail = currentRow?.email_enc ? null : normalizeEmail(currentRow?.email);
      const legacyPhone = currentRow?.phone_enc ? null : normalizePhoneBR(currentRow?.phone);

      const emailHash = hasEmail
        ? (normalizedEmail ? hmacSha256Hex(normalizedEmail) : null)
        : (currentRow?.email_hash || (legacyEmail ? hmacSha256Hex(legacyEmail) : null));
      const phoneHash = hasPhone
        ? (normalizedPhone ? hmacSha256Hex(normalizedPhone) : null)
        : (currentRow?.phone_hash || (legacyPhone ? hmacSha256Hex(legacyPhone) : null));

      const emailEnc = hasEmail
        ? (normalizedEmail ? encryptString(normalizedEmail) : null)
        : (currentRow?.email_enc || (legacyEmail ? encryptString(legacyEmail) : null));
      const phoneEnc = hasPhone
        ? (normalizedPhone ? encryptString(normalizedPhone) : null)
        : (currentRow?.phone_enc || (legacyPhone ? encryptString(legacyPhone) : null));

      const addressEnc = hasAddress
        ? (normalizedAddress ? encryptString(normalizedAddress) : null)
        : (currentRow?.address_enc || (currentRow?.address ? encryptString(normalizeText(currentRow.address)) : null));
      const notesEnc = hasNotes
        ? (normalizedNotes ? encryptString(normalizedNotes) : null)
        : (currentRow?.notes_enc || (currentRow?.notes ? encryptString(normalizeText(currentRow.notes)) : null));
      const birthDateEnc = hasBirthDate
        ? (birth_date ? encryptString(String(birth_date)) : null)
        : (currentRow?.birth_date_enc || (currentRow?.birth_date ? encryptString(String(currentRow.birth_date)) : null));
      const derivedBirth = hasBirthDate ? deriveBirthParts(birth_date ? String(birth_date) : null) : { birth_month: currentRow?.birth_month ?? null, birth_day: currentRow?.birth_day ?? null };
      const { birth_month, birth_day } = derivedBirth;

      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (hasPhone && phoneHash) {
        conditions.push(`phone_hash = $${paramIndex}`);
        params.push(phoneHash);
        paramIndex++;
      }
      
      if (hasEmail && emailHash) {
        conditions.push(`email_hash = $${paramIndex}`);
        params.push(emailHash);
        paramIndex++;
      }
      
      if (conditions.length > 0) {
        params.push(id);
        const existing = await db.query(
          `SELECT id FROM clients WHERE (${conditions.join(' OR ')}) AND id != $${paramIndex} LIMIT 1`, 
          params
        );
        
        if (existing.rows.length) {
          return res.status(409).json({ message: 'Já existe outro cliente com este telefone ou email' });
        }
      }
      
      const { rows } = await db.query(
        `UPDATE clients 
         SET name = $1,
             email = NULL, phone = NULL, address = NULL, birth_date = NULL, notes = NULL,
             email_enc = $2, email_hash = $3,
             phone_enc = $4, phone_hash = $5,
             address_enc = $6,
             birth_date_enc = $7, birth_month = $8, birth_day = $9,
             notes_enc = $10,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $11 
         RETURNING *`,
        [name, emailEnc, emailHash, phoneEnc, phoneHash, addressEnc, birthDateEnc, birth_month, birth_day, notesEnc, id]
      );

      const updatedClient = decryptClientRow(rows[0]);
      
      // Notificar gerentes/donos sobre atualização do cliente
      try {
        const changes = {};
        if (name && name !== currentClient.name) changes.name = name;
        if (updatedClient.email && updatedClient.email !== currentClient.email) changes.email = updatedClient.email;
        if (updatedClient.phone && updatedClient.phone !== currentClient.phone) changes.phone = updatedClient.phone;
        if (updatedClient.address && updatedClient.address !== currentClient.address) changes.address = updatedClient.address;
        
        if (Object.keys(changes).length > 0) {
          await whatsappService.sendSystemChangeNotification(
            'client_updated',
            changes,
            `Cliente: ${updatedClient.name}`
          );
        }
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de atualização de cliente:', notificationError);
      }
      
      res.json(updatedClient);
    } catch (err) {
      console.error('Erro ao atualizar cliente:', err);
      res.status(500).json({ message: 'Erro ao atualizar cliente', ...buildErrorResponse(err) });
    }
  }

  async delete(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    
    try {
      // Verifica se o cliente tem agendamentos
      const appointmentsCheck = await db.query(
        'SELECT COUNT(*) FROM appointments WHERE client_id = $1', 
        [id]
      );
      
      if (parseInt(appointmentsCheck.rows[0].count) > 0) {
        return res.status(409).json({ 
          message: 'Não é possível excluir cliente com agendamentos associados' 
        });
      }
      
      const result = await db.query('DELETE FROM clients WHERE id = $1 RETURNING name', [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }
      
      res.json({ message: `Cliente ${result.rows[0].name} excluído com sucesso` });
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
      res.status(500).json({ message: 'Erro ao excluir cliente', ...buildErrorResponse(err) });
    }
  }

  async getStats(req, res) {
    const db = getPool(req);
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_clients,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_clients_month,
          COUNT(CASE WHEN last_visit >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_clients_month,
          AVG(total_spent) as average_lifetime_value,
          AVG(total_visits) as average_visits_per_client
        FROM clients
      `;
      
      const topClientsQuery = `
        SELECT name, total_spent, total_visits 
        FROM clients 
        WHERE total_spent > 0 
        ORDER BY total_spent DESC 
        LIMIT 10
      `;
      
      const birthdaysQuery = `
        SELECT id, name, phone_enc, birth_date_enc, birth_month, birth_day
        FROM clients 
        WHERE birth_month = EXTRACT(MONTH FROM CURRENT_DATE)
          AND birth_day >= EXTRACT(DAY FROM CURRENT_DATE)
        ORDER BY birth_day
        LIMIT 10
      `;
      
      const [stats, topClients, birthdays] = await Promise.all([
        db.query(statsQuery),
        db.query(topClientsQuery),
        db.query(birthdaysQuery)
      ]);
      
      res.json({
        stats: stats.rows[0],
        top_clients: topClients.rows,
        upcoming_birthdays: birthdays.rows.map(decryptClientRow)
      });
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      res.status(500).json({ message: 'Erro ao buscar estatísticas', ...buildErrorResponse(err) });
    }
  }
}

export default new ClientController();
