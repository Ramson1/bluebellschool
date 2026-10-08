// JavaScript code

// Footer Component: Implements a simple website footer with a navigation link section
import React from 'react';

// Footer component styled and structured with content
const Footer = () => {
    const currentYear = new Date().getFullYear(); // Get the current year

  return (
    <div 
      style={{
        backgroundColor: '#282c34', 
        color: 'white', 
        textAlign: 'center', 
        padding: '20px 0',
        marginTop: '40px'
      }}
    >
      {/* Footer Navigation Links */}

      <div>
        <p style={{ marginBottom: '0px' }}>Powered by Rhema Expert Solutions</p>
      </div>

      <div>
        <a 
          href="tel:+2348035226642" 
          style={{ color: 'white', margin: '0 15px', textDecoration: 'none' }}
        >
          Tel: +234 803 522 6642
        </a>
        <a 
          href="https://www.facebook.com/profile.php?id=100092432334656" 
          style={{ color: 'white', margin: '0 15px', textDecoration: 'none' }}
        >
          Facebook: Rhema Expert Solutions
        </a>
        <a 
          href="https://rhemaexpertsolutions.com" 
          style={{ color: 'white', margin: '0 15px', textDecoration: 'none' }}
        >
          Website: Rhema Expert Solutions
        </a>
      </div>

      {/* Footer Credit */}
      <div style={{ fontSize: '14px', marginTop: '7px' }}>
        <p>© {currentYear} Rhema Expert Solutions. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Footer;