// emailServiceGmail.js - Backend service for sending emails using Gmail SMTP
// EMAIL FUNCTIONALITY COMMENTED OUT FOR VERCEL DEPLOYMENT
// const express = require('express');
// const nodemailer = require('nodemailer');
// const cors = require('cors');
// const { createClient } = require('@supabase/supabase-js');
// require('dotenv').config();

// // Initialize Supabase client
// const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
// const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
// const supabase = createClient(supabaseUrl, supabaseAnonKey);

// const app = express();
// const PORT = process.env.EMAIL_SERVICE_PORT || 3002;

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Create transporter with Gmail SMTP
// const createTransporter = () => {
//   return nodemailer.createTransport({
//     host: 'smtp.gmail.com',
//     port: 587,
//     secure: false, // true for 465, false for other ports
//     auth: {
//       user: process.env.GMAIL_USER, // Email from environment variable
//       pass: process.env.GMAIL_APP_PASSWORD  // App password from environment variable
//     }
//   });
// };

// // Email sending endpoint
// app.post('/api/send-email', async (req, res) => {
//   try {
//     const { subject, text, html } = req.body;

//     // Validate input
//     if (!subject || (!text && !html)) {
//       return res.status(400).json({ error: 'Missing required fields: subject, and either text or html' });
//     }

//     // Fetch admin email from bluebell_settings table
//     const { data: settings, error: settingsError } = await supabase
//       .from('bluebell_settings')
//       .select('adminEmail')
//       .limit(1);

//     if (settingsError) {
//       console.error('Error fetching admin email from settings:', settingsError);
//       return res.status(500).json({ error: 'Failed to fetch admin email', details: settingsError.message });
//     }

//     const adminEmail = settings && settings.length > 0 ? settings[0].adminEmail : null;
//     
//     if (!adminEmail) {
//       console.warn('Admin email not configured in bluebell_settings');
//       return res.status(400).json({ error: 'Admin email not configured' });
//     }

//     // Create transporter
//     const transporter = createTransporter();

//     // Define email options
//     const mailOptions = {
//       from: process.env.GMAIL_USER, // Sender address from environment variable
//       to: adminEmail,               // Recipient address (admin email from settings)
//       subject: subject,             // Subject line
//       text: text,                   // Plain text body
//       html: html                    // HTML body (optional)
//     };

//     // Send email
//     const info = await transporter.sendMail(mailOptions);
//     console.log('Email sent successfully to:', adminEmail);
//     console.log('Message ID:', info.messageId);

//     res.status(200).json({ message: 'Email sent successfully', messageId: info.messageId });
//   } catch (error) {
//     console.error('Error sending email:', error);
//     res.status(500).json({ error: 'Failed to send email', details: error.message });
//   }
// });

// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.status(200).json({ status: 'OK', message: 'Gmail Email service is running' });
// });

// Export the app and transporter for use in other files
// module.exports = { app, createTransporter };

// Only start the server if this file is run directly
// if (require.main === module) {
//   app.listen(PORT, () => {
//     console.log(`Gmail Email service running on port ${PORT}`);
//   });
// }

// Dummy export for compatibility
const dummyApp = { listen: () => {}, post: () => {}, get: () => {} };
const dummyCreateTransporter = () => null;
module.exports = { app: dummyApp, createTransporter: dummyCreateTransporter };