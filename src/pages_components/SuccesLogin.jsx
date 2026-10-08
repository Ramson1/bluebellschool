import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/router";
import { NavbarComponent } from "../components/Navbar.jsx";
import { supabase } from "../supabaseClient.js";

export default function SuccesLogin() {
  const [user, setUser] = useState();
  // Safely initialize router
  let router;
  let isRouterAvailable = false;
  
  try {
    router = useRouter();
    isRouterAvailable = router && router.push;
  } catch (error) {
    console.warn('NextRouter not available in this context');
  }

  useEffect(() => {
    const getUserData = async () => {
      await supabase.auth.getUser().then((value) => {
        if (value.data?.user) {
          setUser(value.data.user);
          console.log(value.data.user);
        }
      });
    };
    getUserData();
  }, []);

  const signOutUser = async () => {
    const { error } = await supabase.auth.signOut();
    router.push("/login");
  };

  const [userauth, setUserAuth] = useState([]); // State for userauth

  useEffect(() => {
    const fetchUserAuth = async () => {
      try {
        const { data, error } = await supabase
          .from('bluebell_userauth') // Assuming 'userauth' is the table name
          .select('email');
        if (error) throw error;
        setUserAuth(data); // Set userauth from Supabase
      } catch (error) {
        alert("Failed to fetch data. Please check your internet connection."); // Added alert for fetch failure
      }
    };
    fetchUserAuth();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="flex flex-col items-center justify-center">
        {user && Object.keys(user).length !== 0 ? (
          (userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email)) ? (
            <>
              <NavbarComponent />
              <h1>SuccesLogin</h1>
              <button onClick={signOutUser}>Sign Out</button>
            </>
          ) : (
            <div style={{ margin: '20%', textAlign: 'center' }}>
              <h3 className=" fontWeight: 900">LOG IN AS ADMIN TO ACCESS THIS PAGE</h3>
              <button onClick={signOutUser} className="btn btn-primary">Sign Out</button>
            </div>
          )
        ) : (
          <div style={{ justifyContent: 'center', alignItems: 'center', flex: 1, width: '60%', textAlign: 'center', margin: 'auto' }}>
            <h1 style={{ marginBottom: 40 }}>User not found, please check your internet connection and login again</h1>
            <button onClick={() => { router.push("/login") }} className="btn btn-primary">Login again</button>
          </div>
        )}
      </div>
    </div>
  )
}