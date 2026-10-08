import React, {useState, useEffect} from "react";
import Carousel from 'react-bootstrap/Carousel';
import 'bootstrap/dist/css/bootstrap.min.css'; // Import Bootstrap CSS for styling
import '../styles/Testimonials.css'; 
import { supabase } from '../supabaseClient.js';

// Testimonials Component with Bootstrap Carousel
export const Testimonials = () => {
    const [settings, setSettings] = useState(null);
    
       useEffect(() => {
        const fetchSettingsTable = async () => {
          try {
            const { data, error } = await supabase.from('jmis_settings').select('*');
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
      const testimonialSession = settings?.testimonialContent
      // Resolves a setting-bucket image: seeded /site/* paths and absolute URLs
      // are used as-is, a bare filename still comes from the public setting bucket.
      const getPublicUrl = (file) => {
        if (!file) return '';
        const value = String(file);
        if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value;
        return 'https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/setting/'.replace(/\/+$/, '/') + value;
      };
  return (
    <section className="testimonials-section">
      {/* Testimonials Header */}
      <h2 className="testimonials-title">What Our Community Says</h2>

      {/* Bootstrap Carousel for Testimonials */}
      <Carousel className="testimonials-carousel">
        {testimonialSession?.map((testimonial, index) => (
          <Carousel.Item key={index}>
            <div className="testimonial-content small-card content">
              <p className="testimonial-text">
                {testimonial?.text}
              </p>
              <div className="testimonial-author">
                <img
                  src={getPublicUrl(testimonial?.image)}
                  alt={`Author ${index}`}
                  className="testimonial-avatar"
                  style={{width: '100px'}}
                />
              </div>
            </div>
          </Carousel.Item>
        ))}
      </Carousel>
    </section>
  );
};

export default Testimonials;