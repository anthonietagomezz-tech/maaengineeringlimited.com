# Maa Engineering Limited — Web Platform

This is the complete corporate web application for Maa Engineering Limited, upgraded with a secure Node.js Express backend, a real-time Live Chat widget, WhatsApp communication triggers, and a premium administrative dashboard.

## Features
- **Modern Corporate UI:** Fully responsive frontend (Home, About, Services, Projects, Leadership, and Contact sections).
- **Floating Action Widget:** A bottom-right floating widget presenting:
  - **Live Web Chat:** Browser-based real-time messaging with support staff.
  - **WhatsApp Direct Chat:** Direct click-to-chat redirection.
- **WhatsApp Form Redirection:** Secondary action button in the inquiry form that pre-fills and opens a WhatsApp chat containing the structured form details (Name, Email, Project type, Message details).
- **Admin Dashboard Panel (`/admin`):** A glassmorphic admin interface featuring:
  - **Overview Stats:** Summary cards of platform status (Total Inquiries, Pending Review, Active Chats, Replied Queries).
  - **Inquiry Mailbox:** An inbox interface where staff can view submissions, delete items, and reply to client inquiries directly via email.
  - **Live Chat Operator Pane:** Real-time multi-room operator terminal to converse with active website visitors.
  - **System Settings:** Administrative password management, target WhatsApp number settings, and Outgoing SMTP server setup.
- **Secure Architecture:** Source code and database files are protected; only the public-facing static folder `/public` is exposed by the HTTP server.

---

## Technical Stack
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla ES6), Socket.io Client.
- **Backend:** Node.js, Express.js.
- **Real-Time Sync:** WebSockets (Socket.io).
- **Database Store:** Asynchronous File JSON Database (`data/db.json`) — 100% portable, requires no compiler dependencies, and acts like a document ORM.
- **Authentication:** JSON Web Tokens (JWT) stored in secure HTTP-only cookies.
- **Cryptography:** Cryptographic salt hashing (`bcryptjs`).
- **Mail Transporter:** NodeMailer.

---

## Installation & Running

### Prerequisites
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)

### Setup Steps

1. **Extract and Navigate to Directory:**
   ```bash
   cd Maa_Engineering_Limited_Website
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```
   This will install all modules defined in `package.json`: `express`, `socket.io`, `jsonwebtoken`, `cookie-parser`, `bcryptjs`, and `nodemailer`.

3. **Start the Application:**
   - **Development (with watch-mode reloading):**
     ```bash
     npm run dev
     ```
   - **Production Mode:**
     ```bash
     npm start
     ```

4. **Access the Portals:**
   - **Visitor Site:** Visit [http://localhost:3000](http://localhost:3000)
   - **Admin Portal:** Visit [http://localhost:3000/admin](http://localhost:3000/admin)

---

## Administrative Credentials

Log in to the administrator portal using the default credentials:
- **Default Username:** `admin`
- **Default Password:** `admin123`

> [!WARNING]
> **Change Default Password Prompt**
> For security, it is highly recommended to change the password immediately after logging in. Navigate to the **Settings** tab, fill out the **Change Portal Password** form, and submit.

---

## System Configuration

### 1. WhatsApp Contact Redirection
By default, the WhatsApp features direct to the company number `233596324748`. 
To modify the contact number:
- Log into the Admin Portal.
- Go to the **Settings** tab.
- Enter the new digits in the **WhatsApp Redirect Settings** (digits only, e.g., `233596324748` for Ghana).
- Click **Save Redirect Config**.

### 2. Email Server (SMTP Configuration)
By default, sending replies in the Inquiry Inbox works in **Simulation Mode** (replies are stored in the database timeline, and mock email text outputs are printed to the server terminal console).
To connect a live company email server:
- Go to **Settings** -> **Email Gateway Server (SMTP Config)**.
- Toggle **Enable Outgoing Email Gateway** to active.
- Enter your SMTP details:
  - **SMTP Host:** (e.g. `smtp.gmail.com` or custom server)
  - **SMTP Port:** (e.g. `587` or `465`)
  - **SMTP Username:** (your email username)
  - **SMTP Password:** (your email password / app password)
  - **Sender Email Address:** (the email address to show as the sender, e.g. `info@maaengineeringlimited.com`)
- Click **Save Gateway settings**.
- Future replies from the inbox will now dispatch real emails to clients.

---

## Project Structure
```
Maa_Engineering_Limited_Website/
├── package.json         # Node metadata and dependencies
├── server.js            # Main Express & Socket.io server
├── database.js          # Lightweight File JSON database layer
├── data/
│   └── db.json          # Database store file (created on launch)
├── public/              # Exposed static directory
│   ├── index.html       # Upgraded frontend website
│   ├── chat-widget.js   # Dynamic floating widget JS
│   ├── chat-widget.css  # Floating widget UI stylesheet
│   └── admin/           # Administrative portal folder
│       ├── index.html   # Admin dashboard layout
│       ├── admin.css    # Admin UI stylesheet
│       └── admin.js     # Admin interactivity script
└── README.md            # Running and setup instructions
```
