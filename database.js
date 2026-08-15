require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.jphlfexykpthnoyplbyn:AU0HiBT4hYpcLWo8@aws-0-ca-central-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Supabase cloud hosted connection
  }
});

class Database {
  async init() {
    console.log('Connecting to PostgreSQL database and initializing tables...');
    try {
      // 1. Create Tables if they do not exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          whatsapp_number VARCHAR(50),
          smtp_enabled BOOLEAN DEFAULT FALSE,
          smtp_host VARCHAR(255) DEFAULT '',
          smtp_port VARCHAR(10) DEFAULT '',
          smtp_user VARCHAR(255) DEFAULT '',
          smtp_pass VARCHAR(255) DEFAULT '',
          sender_email VARCHAR(255) DEFAULT 'info@maaengineeringlimited.com'
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          project_type VARCHAR(100),
          message TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'unread',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS replies (
          id VARCHAR(50) PRIMARY KEY,
          message_id VARCHAR(50) REFERENCES messages(id) ON DELETE CASCADE,
          reply_text TEXT NOT NULL,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS chats (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id VARCHAR(50) PRIMARY KEY,
          chat_id VARCHAR(50) REFERENCES chats(id) ON DELETE CASCADE,
          sender VARCHAR(20) NOT NULL,
          text TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS gallery (
          id VARCHAR(50) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(100) DEFAULT 'General',
          image_url TEXT NOT NULL,
          caption TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure soft-delete columns exist for Data Retention Law compliance
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
        ALTER TABLE gallery ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
        ALTER TABLE gallery ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      `);

      // 2. Populate or Update Administrator Credentials
      const newAdminUsername = 'admin@maaengineeringlimited.com';
      const newAdminPass = 'ShashLina_biz@2026';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newAdminPass, salt);

      const adminCheck = await pool.query('SELECT * FROM admin_users LIMIT 1');
      if (adminCheck.rows.length === 0) {
        console.log('[PG DB] Seed: Adding administrator credentials...');
        await pool.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', [newAdminUsername, passwordHash]);
      } else {
        console.log('[PG DB] Seed: Updating administrator credentials...');
        await pool.query('UPDATE admin_users SET username = $1, password_hash = $2 WHERE id = $3', [newAdminUsername, passwordHash, adminCheck.rows[0].id]);
      }

      // 3. Populate or Update Settings with Working Gmail SMTP Credentials
      const settingsCheck = await pool.query('SELECT * FROM settings LIMIT 1');
      if (settingsCheck.rows.length === 0) {
        console.log('[PG DB] Seed: Inserting default configurations...');
        await pool.query(`
          INSERT INTO settings (whatsapp_number, smtp_enabled, smtp_host, smtp_port, smtp_user, smtp_pass, sender_email)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['233204437721', true, 'smtp.gmail.com', '587', 'shashikumarnishad@maaengineeringlimited.com', 'nuhoixxoqtabjcho', 'shashikumarnishad@maaengineeringlimited.com']);
      } else {
        await pool.query(`
          UPDATE settings SET 
            whatsapp_number = $1,
            smtp_enabled = $2,
            smtp_host = $3,
            smtp_port = $4,
            smtp_user = $5,
            smtp_pass = $6,
            sender_email = $7
        `, ['233204437721', true, 'smtp.gmail.com', '587', 'shashikumarnishad@maaengineeringlimited.com', 'nuhoixxoqtabjcho', 'shashikumarnishad@maaengineeringlimited.com']);
      }

      // 4. Seed Initial Gallery Photos if empty
      await pool.query("DELETE FROM gallery WHERE image_url LIKE '/uploads/%'");
      const galleryCheck = await pool.query('SELECT * FROM gallery LIMIT 1');
      if (galleryCheck.rows.length === 0) {
        console.log('[PG DB] Seed: Adding initial gallery project photos...');
        const initialPhotos = [
          { id: 'gal_1', title: 'Pre-Engineered Warehouse Structure', category: 'PEB & Warehouses', imageUrl: '/service-peb.jpg', caption: 'Heavy-duty steel warehouse frame with insulated roofing.' },
          { id: 'gal_2', title: 'Custom Stainless Steel Pressure Vessel', category: 'Steel Fabrication', imageUrl: '/CUSTOMMETALWORK.jpg', caption: 'Custom MS/SS vessel fabrication and structural assembly.' },
          { id: 'gal_3', title: 'Industrial Roof Truss Erection', category: 'Roofing & Trusses', imageUrl: '/TRUSSESROOFING.jpg', caption: 'Wide-span angular steel roof trusses for industrial complex.' },
          { id: 'gal_4', title: 'Heavy Steel Building Skeleton', category: 'Heavy Structures', imageUrl: '/ConcreteMixerMachines.jpg', caption: 'Multi-level portal framing and structural steel erection.' }
        ];
        for (const p of initialPhotos) {
          await pool.query(`
            INSERT INTO gallery (id, title, category, image_url, caption)
            VALUES ($1, $2, $3, $4, $5)
          `, [p.id, p.title, p.category, p.imageUrl, p.caption]);
        }
      }
      console.log('PostgreSQL database initialization completed successfully.');
    } catch (error) {
      console.error('Error during PostgreSQL tables initialization:', error);
      throw error;
    }
  }

  // --- ADMIN AUTH METHODS ---
  async getAdmin() {
    const res = await pool.query('SELECT username, password_hash FROM admin_users LIMIT 1');
    if (res.rows.length === 0) return null;
    return {
      username: res.rows[0].username,
      passwordHash: res.rows[0].password_hash
    };
  }

  async updateAdminPassword(newPassword) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await pool.query('UPDATE admin_users SET password_hash = $1 WHERE username = $2', [hash, 'admin']);
    return true;
  }

  // --- CONTACT MESSAGES METHODS ---
  async getMessages() {
    const res = await pool.query("SELECT * FROM messages WHERE COALESCE(is_deleted, false) = FALSE AND status != 'deleted' ORDER BY created_at DESC");
    const messages = [];
    for (const row of res.rows) {
      const repliesRes = await pool.query('SELECT id, reply_text, sent_at FROM replies WHERE message_id = $1 ORDER BY sent_at ASC', [row.id]);
      messages.push({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        projectType: row.project_type,
        message: row.message,
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
        replies: repliesRes.rows.map(r => ({
          id: r.id,
          message: r.reply_text,
          sentAt: new Date(r.sent_at).getTime()
        }))
      });
    }
    return messages;
  }

  async getMessageById(id) {
    const res = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    
    const row = res.rows[0];
    const repliesRes = await pool.query('SELECT id, reply_text, sent_at FROM replies WHERE message_id = $1 ORDER BY sent_at ASC', [id]);
    
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      projectType: row.project_type,
      message: row.message,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      replies: repliesRes.rows.map(r => ({
        id: r.id,
        message: r.reply_text,
        sentAt: new Date(r.sent_at).getTime()
      }))
    };
  }

  async createMessage(name, email, phone, projectType, message) {
    const id = 'msg_' + Math.random().toString(36).substr(2, 9);
    await pool.query(`
      INSERT INTO messages (id, name, email, phone, project_type, message, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, name, email, phone, projectType, message, 'unread']);
    
    return {
      id,
      name,
      email,
      phone,
      projectType,
      message,
      status: 'unread',
      createdAt: Date.now(),
      replies: []
    };
  }

  async updateMessageStatus(id, status) {
    await pool.query('UPDATE messages SET status = $1 WHERE id = $2', [status, id]);
    return this.getMessageById(id);
  }

  async addReply(messageId, replyMessage) {
    const replyId = 'rep_' + Math.random().toString(36).substr(2, 9);
    await pool.query(`
      INSERT INTO replies (id, message_id, reply_text)
      VALUES ($1, $2, $3)
    `, [replyId, messageId, replyMessage]);
    
    await pool.query("UPDATE messages SET status = 'replied' WHERE id = $1", [messageId]);
    
    const msg = await this.getMessageById(messageId);
    const reply = {
      id: replyId,
      message: replyMessage,
      sentAt: Date.now()
    };
    
    return { msg, reply };
  }

  async deleteMessage(id) {
    const res = await pool.query(`
      UPDATE messages
      SET is_deleted = TRUE, status = 'deleted', deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
    return res.rowCount > 0;
  }

  // --- LIVE CHAT METHODS ---
  async getChats() {
    const res = await pool.query('SELECT * FROM chats ORDER BY last_message_at DESC');
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      lastMessageAt: new Date(row.last_message_at).getTime()
    }));
  }

  async getChatById(id) {
    const res = await pool.query('SELECT * FROM chats WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      lastMessageAt: new Date(row.last_message_at).getTime()
    };
  }

  async createChatSession(name, email) {
    const chatId = 'chat_' + Math.random().toString(36).substr(2, 9);
    await pool.query(`
      INSERT INTO chats (id, name, email, status, created_at, last_message_at)
      VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [chatId, name || 'Anonymous Visitor', email || '']);

    return {
      id: chatId,
      name: name || 'Anonymous Visitor',
      email: email || '',
      status: 'active',
      createdAt: Date.now(),
      lastMessageAt: Date.now()
    };
  }

  async addChatMessage(chatId, sender, text) {
    const chat = await this.getChatById(chatId);
    if (!chat) return null;

    if (chat.status === 'closed' && sender === 'user') {
      await pool.query("UPDATE chats SET status = 'active', last_message_at = CURRENT_TIMESTAMP WHERE id = $1", [chatId]);
    } else {
      await pool.query("UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1", [chatId]);
    }

    const messageId = 'cmsg_' + Math.random().toString(36).substr(2, 9);
    await pool.query(`
      INSERT INTO chat_messages (id, chat_id, sender, text, timestamp)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [messageId, chatId, sender, text]);

    return {
      id: messageId,
      chatId,
      sender,
      text,
      timestamp: Date.now()
    };
  }

  async getChatMessages(chatId) {
    const res = await pool.query('SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY timestamp ASC', [chatId]);
    return res.rows.map(row => ({
      id: row.id,
      chatId: row.chat_id,
      sender: row.sender,
      text: row.text,
      timestamp: new Date(row.timestamp).getTime()
    }));
  }

  async closeChatSession(chatId) {
    const res = await pool.query("UPDATE chats SET status = 'closed' WHERE id = $1 RETURNING *", [chatId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      lastMessageAt: new Date(row.last_message_at).getTime()
    };
  }

  // --- SYSTEM STATS & SETTINGS ---
  async getStats() {
    const totalRes = await pool.query("SELECT COUNT(*) FROM messages WHERE COALESCE(is_deleted, false) = FALSE AND status != 'deleted'");
    const unreadRes = await pool.query("SELECT COUNT(*) FROM messages WHERE status = 'unread' AND COALESCE(is_deleted, false) = FALSE");
    const repliedRes = await pool.query("SELECT COUNT(*) FROM messages WHERE status = 'replied' AND COALESCE(is_deleted, false) = FALSE");
    const activeChatsRes = await pool.query("SELECT COUNT(*) FROM chats WHERE status = 'active'");
    const totalGalleryRes = await pool.query("SELECT COUNT(*) FROM gallery WHERE COALESCE(is_deleted, false) = FALSE");

    return {
      totalInquiries: parseInt(totalRes.rows[0].count) || 0,
      unreadInquiries: parseInt(unreadRes.rows[0].count) || 0,
      repliedInquiries: parseInt(repliedRes.rows[0].count) || 0,
      activeChats: parseInt(activeChatsRes.rows[0].count) || 0,
      totalGalleryPhotos: parseInt(totalGalleryRes.rows[0].count) || 0
    };
  }

  // --- GALLERY METHODS ---
  async getGalleryItems() {
    const res = await pool.query("SELECT * FROM gallery WHERE COALESCE(is_deleted, false) = FALSE ORDER BY created_at DESC");
    return res.rows.map(row => ({
      id: row.id,
      title: row.title,
      category: row.category,
      imageUrl: row.image_url,
      caption: row.caption,
      createdAt: new Date(row.created_at).getTime()
    }));
  }

  async getGalleryItemById(id) {
    const res = await pool.query('SELECT * FROM gallery WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      imageUrl: row.image_url,
      caption: row.caption,
      createdAt: new Date(row.created_at).getTime()
    };
  }

  async addGalleryItem(title, category, imageUrl, caption) {
    const id = 'gal_' + Math.random().toString(36).substr(2, 9);
    await pool.query(`
      INSERT INTO gallery (id, title, category, image_url, caption)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, title, category || 'General', imageUrl, caption || '']);

    return this.getGalleryItemById(id);
  }

  async deleteGalleryItem(id) {
    const res = await pool.query(`
      UPDATE gallery
      SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async getSettings() {
    const res = await pool.query('SELECT * FROM settings LIMIT 1');
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      whatsappNumber: row.whatsapp_number,
      smtpEnabled: row.smtp_enabled,
      smtpHost: row.smtp_host,
      smtpPort: row.smtp_port,
      smtpUser: row.smtp_user,
      smtpPass: row.smtp_pass,
      senderEmail: row.sender_email
    };
  }

  async updateSettings(settingsObj) {
    const current = await this.getSettings();
    const updated = { ...current, ...settingsObj };
    
    await pool.query(`
      UPDATE settings 
      SET whatsapp_number = $1, smtp_enabled = $2, smtp_host = $3, smtp_port = $4, smtp_user = $5, smtp_pass = $6, sender_email = $7
    `, [
      updated.whatsappNumber,
      updated.smtpEnabled,
      updated.smtpHost,
      updated.smtpPort,
      updated.smtpUser,
      updated.smtpPass,
      updated.senderEmail
    ]);

    return updated;
  }
}

module.exports = new Database();
