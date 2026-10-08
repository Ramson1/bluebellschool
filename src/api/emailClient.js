// emailClient.js - Client-side utility for sending emails through our Gmail service
// EMAIL FUNCTIONALITY COMMENTED OUT FOR VERCEL DEPLOYMENT
// import axios from 'axios';

// // Base URL for our email service
// const EMAIL_SERVICE_BASE_URL = process.env.REACT_APP_EMAIL_SERVICE_URL || 'http://localhost:3001';

/**
 * Send email notification using our Gmail service
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content (optional)
 * @returns {Promise<Object>} - Response from the email service
 */
/*
export const sendEmailNotification = async (subject, text, html = null) => {
  try {
    // Prepare the request payload
    const payload = {
      subject,
      text
    };
    
    // Add HTML content if provided
    if (html) {
      payload.html = html;
    }
    
    // Send request to our email service
    // EMAIL FUNCTIONALITY COMMENTED OUT FOR VERCEL DEPLOYMENT
    /*
    // const response = await axios.post(`${EMAIL_SERVICE_BASE_URL}/api/email/sendEmail`, payload, {
    //   headers: {
    //     'Content-Type': 'application/json'
    //   }
    // });
    */
    
    // Return a mock response for compatibility
    const response = { data: { message: 'Email functionality is disabled', messageId: 'disabled' } };
    
    console.log('Email sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending email notification:', error.response?.data || error.message);
    throw error;
  }
};
*/

// Mock implementation for sendEmailNotification
export const sendEmailNotification = async (subject, text, html = null) => {
  console.log('Email functionality is disabled for Vercel deployment');
  console.log('Subject:', subject);
  console.log('Text:', text);
  console.log('HTML:', html);
  // Return a mock response to maintain compatibility
  return { message: 'Email functionality is disabled', messageId: 'disabled' };
};

/**
 * Fetch admin email from settings
 * @returns {Promise<string|null>} - Admin email address or null if not found
 */
/*
export const getAdminEmail = async () => {
  try {
    // We'll need to import supabase here
    const { supabase } = await import('../supabaseClient');
    
    const { data: settings, error } = await supabase
      .from('jmis_settings')
      .select('adminEmail')
      .limit(1);
      
    if (error) {
      console.error('Error fetching admin email:', error);
      return null;
    }
    
    const adminEmail = settings && settings.length > 0 ? settings[0].adminEmail : null;
    return adminEmail;
  } catch (error) {
    console.error('Error getting admin email:', error);
    return null;
  }
};
*/

// Mock implementation for getAdminEmail
export const getAdminEmail = async () => {
  console.log('Email functionality is disabled for Vercel deployment');
  // Return null to indicate email is disabled
  return null;
};

const emailClient = {
  sendEmailNotification,
  getAdminEmail
};

export default emailClient;