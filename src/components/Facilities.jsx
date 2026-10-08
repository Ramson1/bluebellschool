// Complete React component for a professional and visually appealing Facilities section

import React, {useState, useEffect} from "react";
import '../styles/Facilities.css';
import { supabase } from '../supabaseClient.js';

export const Facilities = () => {
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
          const facilitiesSession = settings?.facilitiesContent
          // Resolves a setting-bucket image: seeded /site/* paths and absolute URLs
          // are used as-is, a bare filename still comes from the public setting bucket.
          const getPublicUrl = (file) => {
            if (!file) return '';
            const value = String(file);
            if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value;
            return 'https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/setting/'.replace(/\/+$/, '/') + value;
          };
  return (
    <section className="facilities">
      {/* Header section for title */}
      <div className="facilities-header">
        <h2>Facilities at Bluebell International School</h2>
        <p>Empowering our students with the best resources for a holistic experience.</p>
      </div>
      
      {/* Description with key feature highlights */}
      <div className="facilities-description">
        <p>
          We believe in providing top-notch facilities
          to create a conducive and inspiring learning environment for all our students.
          Our campus is designed to nurture both academics and extracurricular excellence.
        </p>
      </div>

      {/* Facilities grid section */}
          <div className="facilities-grid">
      {facilitiesSession?.map((facility, index) => (
        <div key={index} className="facility">
          <img src={getPublicUrl(facility.image)} alt={facility.heading} className="facility-img" />
          <h3 className="facility-heading">{facility.heading}</h3>
          <p className="facility-content">{facility.content}</p>
        </div>
      ))}
    </div>
    </section>
  );
};

export default Facilities;