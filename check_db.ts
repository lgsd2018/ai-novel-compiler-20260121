import 'dotenv/config';
import mysql from "mysql2/promise";

async function check() {
  const url = process.env.DATABASE_URL;
  // Mask password for safety in logs
  console.log("DATABASE_URL:", url ? url.replace(/:[^:@]+@/, ":****@") : "undefined");
  
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  try {
    const connection = await mysql.createConnection(url);
    console.log("Successfully connected to database!");
    await connection.end();
  } catch (error: any) {
    console.error("Failed to connect to database:", error.message);
    if (url.includes('@db:')) {
      console.log("HINT: It looks like you are trying to connect to host 'db' but running locally. Try changing 'db' to 'localhost' in your .env file.");
    }
  }
}

check();
