import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import LoginApp from "./auth/login/page";
import RegisterApp from "./auth/register/page";
import AccountApp from "./account/page";

export default function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Navigate to="/auth/login" replace />} />
          <Route path="/auth/register" element={<RegisterApp />} />
          <Route path="/auth/login" element={<LoginApp />} />
          <Route path="/account" element={<AccountApp />} />
        </Routes>
      </div>
    </Router>
  );
}
