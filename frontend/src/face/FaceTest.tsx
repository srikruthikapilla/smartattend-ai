import { useEffect, useState } from "react";
import { loadFaceModels } from "./faceApiLoader";

export default function FaceTest() {
  const [status, setStatus] = useState("Loading AI Models...");

  useEffect(() => {
    async function init() {
      try {
        await loadFaceModels();
        setStatus("✅ Face Models Loaded Successfully");
      } catch (err: any) {
  console.error("FULL ERROR:", err);

  if (err?.message) {
    setStatus(err.message);
  } else {
    setStatus(JSON.stringify(err));
  }
}
    }

    init();
  }, []);

  return (
    <div style={{ padding: "30px" }}>
      <h1>Face API Test</h1>
      <h2>{status}</h2>
    </div>
  );
}