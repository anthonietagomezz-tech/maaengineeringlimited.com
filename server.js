const fs = require('fs');
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'maa-engineering-gold-standard-secret-key-2026';

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (ex) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// Helper: Generate Branded HTML Email Template
function generateBrandedEmailHtml({ title, kicker = '', recipientName = '', contentHtml = '', calloutHtml = '' }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f8; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e9ecef;">
          
          <!-- BRAND HEADER BANNER -->
          <tr>
            <td style="background-color: #111315; border-top: 4px solid #c89b55; padding: 24px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="48" valign="middle">
                    <img src="cid:companylogo" alt="Maa Engineering Logo" width="44" height="44" style="display: block; border-radius: 6px; border: 0;">
                  </td>
                  <td valign="middle" style="padding-left: 14px;">
                    <div style="color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 1.5px; margin: 0; font-family: Arial, sans-serif;">MAA ENGINEERING</div>
                    <div style="color: #c89b55; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px;">LIMITED · STRUCTURAL SOLUTIONS</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY CONTENT -->
          <tr>
            <td style="padding: 36px 32px; color: #111315;">
              ${kicker ? `<div style="color: #c89b55; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">${kicker}</div>` : ''}
              <h1 style="font-size: 22px; font-weight: 800; color: #111315; margin: 0 0 20px 0; line-height: 1.3; font-family: Arial, sans-serif;">${title}</h1>
              
              ${recipientName ? `<div style="font-size: 15px; font-weight: 700; color: #111315; margin-bottom: 16px;">Dear ${recipientName},</div>` : ''}
              
              <div style="font-size: 14px; line-height: 1.7; color: #333940; margin-bottom: 20px;">
                ${contentHtml}
              </div>

              ${calloutHtml ? `
                <div style="background-color: #f8f9fa; border-left: 4px solid #c89b55; border-radius: 6px; padding: 20px; margin: 24px 0; font-size: 13.5px; color: #111315; line-height: 1.6;">
                  ${calloutHtml}
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #16191c; border-top: 1px solid #22262b; padding: 24px 32px; text-align: center; color: #868e96; font-size: 12px;">
              <div style="color: #c89b55; font-weight: 700; letter-spacing: 1px; margin-bottom: 6px; font-size: 13px;">MAA ENGINEERING LIMITED</div>
              <div style="margin-bottom: 10px; color: #a0a6ac; font-size: 11.5px;">Structural Engineering · Steel Fabrication · Industrial Solutions</div>
              <div style="margin-bottom: 12px; font-size: 12px;">
                <a href="https://maaengineeringlimited.com" style="color: #c89b55; text-decoration: none; font-weight: 600; margin: 0 8px;">Website</a> ·
                <a href="https://maaengineeringlimited.com/admin" style="color: #c89b55; text-decoration: none; font-weight: 600; margin: 0 8px;">Admin Portal</a>
              </div>
              <div style="font-size: 11px; color: #6c757d;">© ${new Date().getFullYear()} Maa Engineering Limited. All rights reserved.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Helper: Send email reply via Hostinger SMTP (.env)
async function sendMailHelper(to, subject, textBody, htmlBody = null, settingsOverride = null) {
  const host = process.env.SMTP_HOST || (settingsOverride && settingsOverride.smtpHost);
  const port = parseInt(process.env.SMTP_PORT || (settingsOverride && settingsOverride.smtpPort)) || 465;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || (settingsOverride && settingsOverride.smtpUser);
  const pass = process.env.SMTP_PASS || (settingsOverride && settingsOverride.smtpPass);
  const sender = process.env.SMTP_USER || (settingsOverride && settingsOverride.senderEmail) || 'support@winningedgeinvestment.com';

  if (!host || !user || !pass) {
    console.log(`[SMTP MOCK] Email to: ${to} | Subject: ${subject}`);
    return { mock: true, sent: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });

    const logoPath = path.join(__dirname, 'public', 'logo.JPG');
    const attachments = [];
    if (fs.existsSync(logoPath)) {
      attachments.push({
        filename: 'logo.JPG',
        path: logoPath,
        cid: 'companylogo'
      });
    }

    const info = await transporter.sendMail({
      from: `"Maa Engineering Limited" <${sender}>`,
      to,
      subject,
      text: textBody,
      html: htmlBody || textBody.replace(/\n/g, '<br>'),
      attachments
    });

    console.log('[SMTP SUCCESS] Email sent to %s (Message ID: %s)', to, info.messageId);
    return { mock: false, sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('[SMTP ERROR] Failed to send email to %s:', to, error);
    throw error;
  }
}

// --- PUBLIC API ENDPOINTS ---

// Submit Contact Message
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, projectType, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  try {
    const newMessage = await db.createMessage(name, email, phone, projectType, message);
    
    // Notify admins about new message via socket.io
    io.emit('newInquiry', newMessage);

    // Send auto-acknowledgement email to visitor
    try {
      const ackHtml = generateBrandedEmailHtml({
        title: 'Project Enquiry Acknowledgement',
        kicker: 'ENQUIRY RECEIVED',
        recipientName: name,
        contentHtml: `<p>Thank you for contacting Maa Engineering Limited. We have received your project enquiry regarding <strong>"${projectType || 'General Enquiry'}"</strong>.</p><p>Our engineering team will review your specifications and get back to you shortly with next steps.</p>`,
        calloutHtml: `<strong>Submitted Details:</strong><br><strong>Project Interest:</strong> ${projectType || 'General Enquiry'}<br><strong>Message:</strong> ${message}`
      });

      await sendMailHelper(
        email,
        'Thank you for contacting Maa Engineering Limited',
        `Dear ${name},\n\nThank you for reaching out to Maa Engineering Limited. We have received your project enquiry regarding "${projectType || 'General Enquiry'}".\n\nOur engineering team will review your request and get back to you shortly.\n\nBest regards,\nMaa Engineering Limited Team`,
        ackHtml
      );
    } catch (mailErr) {
      console.warn('Auto-acknowledgement email failed, but inquiry was saved.', mailErr.message);
    }

    // Send admin notification email if ADMIN_EMAIL is configured
    const adminEmail = process.env.ADMIN_EMAIL || 'support@winningedgeinvestment.com';
    if (adminEmail) {
      try {
        const adminHtml = generateBrandedEmailHtml({
          title: 'New Project Enquiry Received',
          kicker: 'WEBSITE INQUIRY ALERT',
          recipientName: 'Administrator',
          contentHtml: `<p>A new project enquiry has been submitted through the Maa Engineering Limited website.</p>`,
          calloutHtml: `<strong>Client Name:</strong> ${name}<br><strong>Email Address:</strong> <a href="mailto:${email}">${email}</a><br><strong>Phone Number:</strong> ${phone || 'Not provided'}<br><strong>Project Interest:</strong> <span style="color:#c89b55; font-weight:700;">${projectType || 'General Enquiry'}</span><br><br><strong>Message Body:</strong><br>${message}`
        });

        await sendMailHelper(
          adminEmail,
          `[New Project Enquiry] From ${name} - ${projectType || 'General'}`,
          `New Project Enquiry Details:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nProject Interest: ${projectType || 'General'}\n\nMessage:\n${message}\n\n---\nReceived on Maa Engineering Limited Website`,
          adminHtml
        );
      } catch (adminMailErr) {
        console.warn('Admin notification email failed.', adminMailErr.message);
      }
    }

    res.status(201).json({ success: true, message: 'Enquiry submitted successfully!', inquiryId: newMessage.id });
  } catch (error) {
    console.error('Error handling contact submission:', error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// Get Chat Session Status (Public, for widget restoration)
app.get('/api/chats/:id', async (req, res) => {
  try {
    const chat = await db.getChatById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve chat session' });
  }
});

// Get Chat Session Messages (Public, for widget restoration)
app.get('/api/chats/:id/messages', async (req, res) => {
  try {
    const messages = await db.getChatMessages(req.params.id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const admin = await db.getAdmin();
    if (admin.username !== username) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const validPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT
    const token = jwt.sign({ username: admin.username }, JWT_SECRET, { expiresIn: '24h' });

    // Set HTTP-only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({ success: true, token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Admin Authentication Check
app.get('/api/admin/check-auth', authenticateAdmin, (req, res) => {
  res.json({ authenticated: true, username: req.admin.username });
});


// --- PROTECTED ADMIN API ENDPOINTS ---

// Get Dashboard Statistics
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

// Get All Contact Messages
app.get('/api/admin/messages', authenticateAdmin, async (req, res) => {
  try {
    const messages = await db.getMessages();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
});

// Get Contact Message Details
app.get('/api/admin/messages/:id', authenticateAdmin, async (req, res) => {
  try {
    const message = await db.getMessageById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    // Update message status to "read" if it was "unread"
    if (message.status === 'unread') {
      await db.updateMessageStatus(message.id, 'read');
    }
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve message.' });
  }
});

// Reply to a Contact Message (sends email)
app.post('/api/admin/messages/:id/reply', authenticateAdmin, async (req, res) => {
  const { replyText } = req.body;
  if (!replyText || replyText.trim() === '') {
    return res.status(400).json({ error: 'Reply text is required.' });
  }

  try {
    const message = await db.getMessageById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Inquiry not found.' });
    }

    const replyHtml = generateBrandedEmailHtml({
      title: `Response to your enquiry regarding ${message.projectType || 'Steel Works'}`,
      kicker: 'PROJECT ENQUIRY RESPONSE',
      recipientName: message.name,
      contentHtml: replyText.replace(/\n/g, '<br>')
    });
    
    // Send email
    const mailResult = await sendMailHelper(
      message.email,
      `RE: Enquiry regarding ${message.projectType || 'Steel Works'} - Maa Engineering Ltd`,
      replyText,
      replyHtml
    );

    // Save reply to database
    const { reply } = await db.addReply(message.id, replyText);

    res.json({
      success: true,
      message: 'Reply sent successfully.',
      reply,
      mailResult
    });
  } catch (error) {
    console.error('Error replying to message:', error);
    res.status(500).json({ error: 'Failed to send reply. Please verify SMTP settings.' });
  }
});

// Delete a Contact Message
app.delete('/api/admin/messages/:id', authenticateAdmin, async (req, res) => {
  try {
    const success = await db.deleteMessage(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    res.json({ success: true, message: 'Message deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message.' });
  }
});

// Get All Chat Sessions
app.get('/api/admin/chats', authenticateAdmin, async (req, res) => {
  try {
    const chats = await db.getChats();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve chats.' });
  }
});

// Get Messages for a Chat Session
app.get('/api/admin/chats/:id/messages', authenticateAdmin, async (req, res) => {
  try {
    const chatMessages = await db.getChatMessages(req.params.id);
    res.json(chatMessages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve chat messages.' });
  }
});

// Close Chat Session
app.post('/api/admin/chats/:id/close', authenticateAdmin, async (req, res) => {
  try {
    const chat = await db.closeChatSession(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found.' });
    }
    // Emit session closed event
    io.to(`chat_${chat.id}`).emit('sessionClosed', { chatId: chat.id });
    res.json({ success: true, chat });
  } catch (error) {
    res.status(500).json({ error: 'Failed to close chat session.' });
  }
});

// Get Settings
app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve settings.' });
  }
});

// Update Settings
app.post('/api/admin/settings', authenticateAdmin, async (req, res) => {
  try {
    const updatedSettings = await db.updateSettings(req.body);
    res.json({ success: true, settings: updatedSettings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Change Admin Password
app.post('/api/admin/change-password', authenticateAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  try {
    const admin = await db.getAdmin();
    const validPassword = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    await db.updateAdminPassword(newPassword);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});


// --- REAL-TIME LIVE CHAT (SOCKET.IO) ---

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Client or Admin joins a room for a specific chat
  socket.on('joinChat', ({ chatId }) => {
    socket.join(`chat_${chatId}`);
    console.log(`Socket ${socket.id} joined room chat_${chatId}`);
  });

  // Client starts a chat session
  socket.on('startSession', async ({ name, email, text }) => {
    try {
      const chat = await db.createChatSession(name, email);
      socket.join(`chat_${chat.id}`);
      
      console.log(`New chat session created: ${chat.id} by ${chat.name}`);
      
      // Send session info back to client
      socket.emit('sessionCreated', chat);

      // Notify admins
      io.emit('newChatSession', chat);

      // Add the initial message if provided
      if (text && text.trim() !== '') {
        const msg = await db.addChatMessage(chat.id, 'user', text);
        io.to(`chat_${chat.id}`).emit('newMessage', msg);
        io.emit('chatListUpdate'); // Tell admin to update chat list
      }
    } catch (err) {
      console.error('Error starting chat session:', err);
      socket.emit('error', 'Failed to start chat session.');
    }
  });

  // Handle message sending (from user or admin)
  socket.on('sendMessage', async ({ chatId, sender, text }) => {
    try {
      const msg = await db.addChatMessage(chatId, sender, text);
      if (msg) {
        // Broadcast message to room (both client and admin see it)
        io.to(`chat_${chatId}`).emit('newMessage', msg);
        
        // Notify admin dashboard to refresh lists
        io.emit('chatListUpdate');
      } else {
        socket.emit('error', 'Chat session not found.');
      }
    } catch (err) {
      console.error('Error sending chat message:', err);
    }
  });

  // Typing indicators
  socket.on('typing', ({ chatId, sender }) => {
    socket.to(`chat_${chatId}`).emit('typing', { chatId, sender });
  });

  socket.on('stopTyping', ({ chatId, sender }) => {
    socket.to(`chat_${chatId}`).emit('stopTyping', { chatId, sender });
  });

  socket.on('closeSession', async ({ chatId }) => {
    try {
      const chat = await db.closeChatSession(chatId);
      if (chat) {
        io.to(`chat_${chat.id}`).emit('sessionClosed', { chatId: chat.id });
        io.emit('chatListUpdate');
      }
    } catch (err) {
      console.error('Error closing session:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize DB and start server
db.init().then(() => {
  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` Maa Engineering Limited Backend is Running!`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(` Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`===============================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database. Server shutting down.', err);
});
