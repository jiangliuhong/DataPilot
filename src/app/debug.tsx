"use client";

import { useEffect } from "react";

export default function DebugPage() {
  useEffect(() => {
    console.log("Debug page mounted");
    console.log("Document body:", document.body.innerHTML);
    console.log("Window location:", window.location.href);
  }, []);

  return (
    <div style={{
      padding: "20px",
      backgroundColor: "white",
      color: "black",
      minHeight: "100vh",
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999
    }}>
      <h1 style={{ color: "blue" }}>Debug Page</h1>
      <p>如果你能看到这个页面，那么React是工作的。</p>
      <p>当前时间: {new Date().toLocaleString()}</p>
      <button onClick={() => alert("Button clicked!")}>测试按钮</button>
    </div>
  );
}
