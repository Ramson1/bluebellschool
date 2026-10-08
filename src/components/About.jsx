// About.tsx

import React, {useState, useEffect} from "react";
import '../styles/About.css';
import { supabase } from '../supabaseClient.js';

export const About = () => {
  const [settings, setSettings] = useState(null);
  
     useEffect(() => {
      const fetchSettingsTable = async () => {
        try {
          const { data, error } = await supabase.from('jmis_settings').select('*').single();
          if (error) {
            console.error('Error fetching settings table:', error);
            throw error;
          }
          // Update state with the fetched data
          setSettings(data);
        } catch (err) {
          console.error('Error fetching settings table:', err);
        }
      };
      fetchSettingsTable();
      }, []);
    const aboutSession = settings?.aboutContent
  return (
    <section className="about-section">
      {/* Hero Image and Title */}
      <div className="about-hero" >
        <h2 className="about-title">About Bluebell International School</h2>
      </div>

      {/* About Content Section */}
      <div className="about-content">
        {/* Mission Statement */}
        <div className="about-mission">
          <h3 className="about-heading">Our Mission</h3>
          <p>
            {aboutSession?.text}
          </p>
        </div>

        {/* Excellence Highlights */}
        {/* <div className="about-highlights">
          <h3 className="about-heading">Why Choose Us?</h3>
          <ul>
            <li>
              <strong>50 Years of Excellence:</strong> A legacy of delivering quality education since our founding.
            </li>
            <li>
              <strong>Holistic Development:</strong> Focused programs in academics, arts, athletics, and character building.
            </li>
            <li>
              <strong>Global Community:</strong> With students from diverse backgrounds, we embrace and celebrate cultural diversity.
            </li>
            <li>
              <strong>Technological Integration:</strong> Cutting-edge facilities and use of smart technology for modern education.
            </li>
          </ul>
        </div> */}
        <div className="about-highlights">
      <h3 className="about-heading">Why Choose Us?</h3>
      <ul>
        {aboutSession?.details.map((highlight, index) => (
          <li key={index}>
            <strong>{highlight.heading}:</strong> {highlight.content}
          </li>
        ))}
      </ul>
    </div>

        {/* Closing Statement */}
        <div className="about-closing">
          <p>
            {aboutSession?.text2}
          </p>
        </div>
      </div>
    </section>
  );
};

export default About;