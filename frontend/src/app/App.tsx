import { Routes, Route } from "react-router-dom";
import Optimization from "./Optimization";
import Settings from "./Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Optimization />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}