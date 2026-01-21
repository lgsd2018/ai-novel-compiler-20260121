import { createRoot } from "react-dom/client";
import React from "react";
import { trpc } from "@/lib/trpc";

console.log("Debug Main executing...");
console.log("TRPC imported:", trpc);

const root = document.getElementById("root");
if (root) {
    createRoot(root).render(
        <div style={{ padding: 20, background: 'lightgreen', color: 'black' }}>
            <h1>Debug Mode Active</h1>
            <p>Vite is working correctly.</p>
            <p>Time: {new Date().toISOString()}</p>
        </div>
    );
} else {
    console.error("Root element not found");
}
