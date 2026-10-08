// Import necessary modules and components
import React from "react";
import Hero from "../components/Hero";
import About from "../components/About";
import Facilities from "../components/Facilities";
import Testimonials from "../components/Testimonials";
import Contact from "../components/Contact";
import { NavbarWeb } from "../components/NavbarWeb";
import Gallery from "../components/Gallery";
import Footer from "../components/Footer";

function Web() {
  return (
    <div className="App">
      {/* Assign 'NavbarWeb' component as the page header */}
      <header>
        <NavbarWeb />
      </header>

      <main style={{paddingTop: '60px'}}>
        {/* Main sections of the page, with IDs for easier navigation */}
        <div id="hero"><Hero /></div>
        <div id="about"><About /></div>
        <div id="facilities"><Facilities /></div>
        <div id='gallery'><Gallery /></div>
        <div id="testimonials"><Testimonials /></div>
        <div id="contact"><Contact /></div>
        <div><Footer /></div>
      </main>
    </div>
  );
}

export default Web;