import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import LoginApp from "./login/page";
import RegisterApp from "./register/page";
import AccountApp from "./account/page";

export default function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<RegisterApp />} />
          <Route path="/login" element={<LoginApp />} />
          <Route path="/account" element={<AccountApp />} />
        </Routes>
      </div>
    </Router>
  );
}
