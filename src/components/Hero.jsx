// Hero.js
import React, {useState, useEffect} from 'react';
import { Carousel } from 'react-bootstrap';
import '../styles/herostyles.css';
import { supabase } from '../supabaseClient.js';

const Hero = () => {
    const [settings, setSettings] = useState(null);

    useEffect(() => {
    const fetchSettingsTable = async () => {
      try {
        const { data, error } = await supabase.from('bluebell_settings').select('*').single();
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
  const heroSession = settings?.heroContent
  // Resolves a setting-bucket image: seeded /site/* paths and absolute URLs
  // are used as-is, a bare filename still comes from the public setting bucket.
  const getPublicUrl = (file) => {
    if (!file) return '';
    const value = String(file);
    if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value;
    return 'https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/setting/'.replace(/\/+$/, '/') + value;
  };
  
  return (
    // <Carousel interval={5000} pause={false} className='hero'>
    //   <Carousel.Item>
    //     <img src={image1} alt="Exquisite Training Environment" />
    //     <Carousel.Caption>
    //       {/* Slide 1: Highlighting excellence in education */}
    //       <h3>Excellence in Education</h3>
    //       <p>
    //         At Divison International School, we empower young minds with a solid foundation for academic success and personal growth.
    //       </p>
    //     </Carousel.Caption>
    //   </Carousel.Item>
    //   <Carousel.Item>
    //     <img src={image2} alt="Diverse Learning Facilities" />
    //     <Carousel.Caption>
    //       {/* Slide 2: Showcasing facilities that enhance learning */}
    //       <h3>World-Class Learning Facilities</h3>
    //       <p>
    //         Experience state-of-the-art laboratories, libraries, and technology that nurture a love for learning and discovery.
    //       </p>
    //     </Carousel.Caption>
    //   </Carousel.Item>
    //   <Carousel.Item>
    //     <img src={image3} alt="Values-Based Education" />
    //     <Carousel.Caption>
    //       {/* Slide 3: Focusing on character and values */}
    //       <h3>Values & Character Building</h3>
    //       <p>
    //         We shape future leaders by instilling values of integrity, inclusiveness, and resilience to thrive in an ever-changing world.
    //       </p>
    //     </Carousel.Caption>
    //   </Carousel.Item>
    // </Carousel>
    <Carousel interval={5000} pause={false} className='hero'>
      {heroSession?.map((item, index) => (
        <Carousel.Item key={index}>
          <img src={getPublicUrl(item.image)} alt={item.heading} />
          <Carousel.Caption>
            <h3>{item.heading}</h3>
            <p>{item.content}</p>
          </Carousel.Caption>
        </Carousel.Item>
      ))}
    </Carousel>
  );
}

export default Hero;