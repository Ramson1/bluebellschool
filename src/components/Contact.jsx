// Import required libraries and packages
import React, { useState, useEffect } from "react";
import "../styles/Contact.css";
import emailjs from "@emailjs/browser";
import { supabase } from '../supabaseClient.js';

// Contact component
export const Contact = () => {
    const [settings, setSettings] = useState(null);
    
       useEffect(() => {
        const fetchSettingsTable = async () => {
          try {
            const { data, error } = await supabase.from('bluebell_settings').select('*');
            if (error) {
              console.error('Error fetching settings table:', error);
              throw error;
            }
            // Use the first row if data exists, otherwise set to empty object
            setSettings(data && data.length > 0 ? data[0] : {});
          } catch (err) {
          console.error('Error fetching settings table:', err);
          }
        };
        fetchSettingsTable();
        }, []);
      const contactSession = settings?.contactContent;
  // State management to handle form inputs and submission status
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle form submission using EmailJS
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Replace with your actual EmailJS configuration
      const serviceId = "service_7zlz0tc";
      const templateId = "template_fffeai9";
      const publicKey = "tPlH7Y-mAUixXjJxJ";

      const templateParams = {
        from_name: formData.name,
        from_email: formData.email,
        message: formData.message,
      };

      // Use EmailJS SDK to send the email
      const response = await emailjs.send(serviceId, templateId, templateParams, publicKey);

      if (response.status === 200) {
        setSuccessMessage("Your message has been sent successfully!");
        setFormData({
          name: "",
          email: "",
          message: "",
        });
      } else {
        throw new Error("Failed to send the message. Please try again.");
      }
    } catch (err) {
      // Log and display the error message
      console.error("Error sending email through EmailJS:", err.message);
      setErrorMessage(
        err.message || "Something went wrong. Please try again later."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="contact-section container">
      {/* Text describing the contact section */}
      <h2 className="contact-title">Get in Touch</h2>
      <p className="contact-description">
        Feel free to contact us for more information or if you have any
        questions. We're here to help!
      </p>

      {/* Additional contact information */}
      <div className="contact-details">
        <div className="contact-info">
          <h3>Email</h3>
          <p>{contactSession?.email}</p>
        </div>
        <div className="contact-info">
          <h3>Phone</h3>
          <p>{contactSession?.phone}</p>
        </div>
        <div className="contact-info">
          <h3>Address</h3>
          <p>{contactSession?.address}</p>
        </div>
      </div>

      {/* Form for users to submit their messages */}
      <form className="contact-form" onSubmit={handleSubmit}>
        <h3>Send Us a Message</h3>
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="Enter your name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            name="message"
            rows={5}
            placeholder="Enter your message"
            value={formData.message}
            onChange={handleChange}
            required
          ></textarea>
        </div>
        <button type="submit" className="submit-button" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Submit"}
        </button>
      </form>

      {/* Display success or error messages */}
      {successMessage && <p className="success-message">{successMessage}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </section>
  );
};

export default Contact;