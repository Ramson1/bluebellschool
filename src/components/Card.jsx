import React, { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom"; // Unused import removed
import { supabase } from "../supabaseClient";

export default function CardComponent({ payments }) {

    // const [paymentList, setPaymentList] = useState([]) // Unused state removed
    // useEffect(() => { // Unused effect removed
    //     getProducts();
    // }, [])
    //
    // async function getProducts() { // Unused function removed
    //     try {
    //         const { data, error } = await supabase
    //             .from('bluebell_paymentsinfo')
    //             .select("*")
    //             .limit(4)
    //         if (error) throw error;
    //         if (data != null) {
    //             setPaymentList(data)
    //         }
    //     } catch (error) {
    //         // alert(error.message)
    //     }
    // }
    return (
<div>
  <div
    style={{
      maxWidth: 370,
      margin: "24px auto",
      borderRadius: 20,
      boxShadow: "0 8px 32px rgba(44,62,80,0.13)",
      overflow: "hidden",
      background: "linear-gradient(135deg, #f8fafc 0%, #e3e9f7 100%)",
      transition: "box-shadow 0.2s, transform 0.2s",
      border: "1px solid #f0f2f5",
    }}
    className="payment-card hoverable"
  >
    <div
      style={{
        background:
          payments.description === "School Fees"
            ? "linear-gradient(90deg, #7ea6ef 0%, #0832a5 100%)"
            : "linear-gradient(90deg, #36d1c4 0%, #5b86e5 100%)",
        padding: "14px",
        display: "flex",
        flexDirection: "row",
                        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #e3e9f7",
      }}
    >
      <h6
        style={{
          color: "#fff",
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: 1,
          marginBottom: 6,
          textShadow: "0 2px 8px rgba(44,62,80,0.10)",
        }}
      >
        {payments.description}
      </h6>
      <div
        style={{
          background: "rgba(255,255,255,0.18)",
          borderRadius: 12,
          padding: "4px 18px",
          fontWeight: 700,
          color: "#fff",
          fontSize: 16,
          boxShadow: "0 1px 4px rgba(44,62,80,0.07)",
        }}
      >
        {payments.description === "School Fees" ? "Success" : "Paid"}
      </div>
    </div>
    <div
      style={{
        padding: "24px 28px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h5
        style={{
          fontWeight: 700,
          color: "#4e73df",
          fontSize: 20,
          marginBottom: 2,
        }}
      >
        {payments.name}
      </h5>
      <h6
        style={{
          fontWeight: 700,
          color: "#1cc88a",
          fontSize: 14,
          marginBottom: 3,
        }}
      >
        {payments.class}
      </h6>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#888",
          fontSize: 14,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 16 }}>📆</span>
        <span>{payments.date}</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#f8fafc",
          borderRadius: 10,
          padding: "8px 14px",
          marginTop: 0,
        }}
      >
        <span style={{ fontSize: 15, color: "#1cc88a" }}>✅</span>
        <span style={{ color: "#4e73df", fontWeight: 600, fontSize: 15 }}>
          {payments.user_id || payments.paymentdescription}
        </span>
      </div>
    </div>
  </div>
</div>
    )
}

// const styles = { // Unused styles removed
//     container: {
//         backgroundColor: 'white',
//         borderRadius: 8,
//         overflow: 'hidden',
//         width: '18rem',
//         alignSelf: 'center',
//         boxShadow: '3px 3px 3px rgba(0, 0, 0, 0.1)',
//         elevation: 3,
//     },
//     header: {
//         padding: 10,
//         display: 'flex',
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//     },
//     headerText: {
//         color: 'white',
//         fontWeight: 'bold',
//     },
//     percentageContainer: {
//         backgroundColor: 'rgba(255, 255, 255, 0.2)',
//         borderRadius: 10,
//         paddingleft: 25,
//         paddingRight: 15,
//         textAlign: 'center'
//     },
//     percentageText: {
//         color: 'white',
//         fontSize: 12,
//         paddingTop: '10px',
//         paddingLeft: '10px',
//     },
//     content: {
//         padding: 16,
//         backgroundColor: 'white'
//     },
//     nameText: {
//         fontSize: 24,
//         fontWeight: 'bold',
//         color: 'black',
//     },
//     gradeText: {
//         fontSize: 14,
//         color: 'gray',
//         marginTop: 4,
//     },
//     infoRow: {
//         backgroundColor: 'white'
//     },
//     infoItem: {
//         alignItems: 'center',
//         backgroundColor: 'white'
//     },
//     infoText: {
//         marginLeft: 4,
//         color: '#6B7280',
//         fontSize: '14px'
//     },
//     footer: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         backgroundColor: 'white'
//     },
//     footerText: {
//         marginLeft: 4,
//         color: '#22C55E',
//         fontWeight: 'bold',
//         fontSize: '14px'
//     },
// }