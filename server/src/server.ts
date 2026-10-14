
import "dotenv/config";
import app from "./app";

// Read the port from the environment.
const PORT = Number(process.env.PORT) || 5000;

// Start the backend server.
app.listen(PORT, () => {
  console.log(`Optical CRM API running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
});
