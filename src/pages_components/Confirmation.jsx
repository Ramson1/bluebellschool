import React from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import '../styles/Confirmation.css';

const Confirmation = () => {
  return (
    <div className="confirmation-container">
      <div className="confirmation-card">
        <FaCheckCircle className="confirmation-icon" />
        <h1 className="confirmation-title">Email Confirmed</h1>
        <p className="confirmation-message">Your email has been confirmed. You can now proceed to login.</p>
        {/* <button className="confirmation-button" onClick={() => window.location.href = '/login'}>Go to Login</button> */}
      </div>
    </div>
  );
};

export default Confirmation;
