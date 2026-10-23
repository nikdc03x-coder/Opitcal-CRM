// Service layer: prepare the information returned by
// our backend health check.

export function getHealthStatus() {
  return {
    success: true,
    message: "Optical CRM backend is working!",
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
}
