import { AuthProvider } from "./app/AuthProvider";
import { AppRoutes } from "./app/router";

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
