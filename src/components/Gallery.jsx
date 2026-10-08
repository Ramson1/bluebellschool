// Importing React and useState for managing component state
import React, { useState, useEffect } from "react";
// Importing basic styling for the Gallery
import '../styles/Gallery.css'; // Assuming CSS styles will be added in this file
import { supabase } from '../supabaseClient.js';

const Gallery = () => {
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
        const gallerySession = settings?.galleryContent
        // Resolves a setting-bucket image: seeded /site/* paths and absolute URLs
        // are used as-is, a bare filename still comes from the public setting bucket.
        const getPublicUrl = (file) => {
          if (!file) return '';
          const value = String(file);
          if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value;
          return 'https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/setting/'.replace(/\/+$/, '/') + value;
        };
  // State to track if additional items should be displayed
  const [showMore, setShowMore] = useState(false);

  // Function to toggle the show more/less state
  const toggleShowMore = () => setShowMore(!showMore);

  return (
    <div className="gallery-container">
      <h2 className="gallery-title">Image Gallery</h2>
      <div className="image-grid">
        {/* Only display 3 images if showMore is false */}
        {gallerySession?.slice(0, showMore ? gallerySession.length : 3).map((image, index) => (
          <div key={index} className="image-card">
            <img src={getPublicUrl(image?.image)} alt={image.description} className="image" />
            <p className="image-description">{image?.content}</p>
          </div>
        ))}
      </div>
      <button className="toggle-button" onClick={toggleShowMore}>
        {showMore ? "Show Less" : "View More"}
      </button>
    </div>
  );
};

export default Gallery;