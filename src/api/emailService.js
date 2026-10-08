// emailService.js - Backend service for sending emails
// EMAIL FUNCTIONALITY COMMENTED OUT FOR VERCEL DEPLOYMENT
// const express = require('express');
// const nodemailer = require('nodemailer');
// const cors = require('cors');
// require('dotenv').config();

// const app = express();
// const PORT = process.env.PORT || 3001;

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Create transporter with Gmail SMTP
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.REACT_APP_EMAIL_USER || process.env.EMAIL_USER, // Email from environment variable
//     pass: process.env.REACT_APP_EMAIL_PASS || process.env.EMAIL_PASS  // Password from environment variable
//   }
// });

// // Email sending endpoint
// app.post('/api/send-email', async (req, res) => {
//   try {
//     const { to, subject, text } = req.body;

//     // Validate input
//     if (!to || !subject || !text) {
//       return res.status(400).json({ error: 'Missing required fields: to, subject, text' });
//     }

//     // Define email options
//     const mailOptions = {
//       from: process.env.REACT_APP_EMAIL_USER || process.env.EMAIL_USER, // Sender address from environment variable
//       to: to,                       // Recipient address
//       subject: subject,             // Subject line
//       text: text                    // Plain text body
//     };

//     // Send email
//     const info = await transporter.sendMail(mailOptions);
//     console.log('Email sent successfully to:', to);
//     console.log('Message ID:', info.messageId);

//     res.status(200).json({ message: 'Email sent successfully', messageId: info.messageId });
//   } catch (error) {
//     console.error('Error sending email:', error);
//     res.status(500).json({ error: 'Failed to send email', details: error.message });
//   }
// });

// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.status(200).json({ status: 'OK', message: 'Email service is running' });
// });

// Export the app for use in other files
// module.exports = { app, transporter };

// Only start the server if this file is run directly
// if (require.main === module) {
//   app.listen(PORT, () => {
//     console.log(`Email service running on port ${PORT}`);
//   });
// }

// Dummy export for compatibility
const dummyApp = { listen: () => {}, post: () => {}, get: () => {} };
module.exports = { app: dummyApp, transporter: null };