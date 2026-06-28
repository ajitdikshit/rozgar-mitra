import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LangProvider } from "./context/LangContext";
import { NotificationProvider } from "./context/NotificationContext";
import Login from "./pages/Login";
import Jobs from "./pages/Jobs";
import ActiveJob from "./pages/ActiveJob";
import PendingJobs from "./pages/PendingJobs";
import JobRequests from "./pages/JobRequests";
import Passport from "./pages/Passport";
import History from "./pages/History";
import Reviews from "./pages/Reviews";
import Profile from "./pages/Profile";
import PostJob from "./pages/PostJob";
import PostedJobs from "./pages/PostedJobs";
import BrowseWorkers from "./pages/BrowseWorkers";
import ActiveJobs from "./pages/ActiveJobs";
import EmployerHistory from "./pages/EmployerHistory";
import EmployerReviews from "./pages/EmployerReviews";
import EmployerProfile from "./pages/EmployerProfile";
import SkillTest from "./pages/SkillTest";
import "./App.css";

function Guard({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-center">…</div>;
  if (!user) return <Navigate to="/login" replace/>;
  if (role && user.role !== role) return <Navigate to={user.role === "worker" ? "/w/jobs" : "/e/post"} replace/>;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace/>;
  return <Navigate to={user.role === "worker" ? "/w/jobs" : "/e/post"} replace/>;
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <BrowserRouter>
          <NotificationProvider>
          <Toaster position="top-center" richColors closeButton/>
          <Routes>
            <Route path="/" element={<RootRedirect/>}/>
            <Route path="/login" element={<Login/>}/>

            <Route path="/w/jobs" element={<Guard role="worker"><Jobs/></Guard>}/>
            <Route path="/w/active" element={<Guard role="worker"><ActiveJob/></Guard>}/>
            <Route path="/w/pending" element={<Guard role="worker"><PendingJobs/></Guard>}/>
            <Route path="/w/invites" element={<Guard role="worker"><JobRequests/></Guard>}/>
            <Route path="/w/passport" element={<Guard role="worker"><Passport/></Guard>}/>
            <Route path="/w/history" element={<Guard role="worker"><History/></Guard>}/>
            <Route path="/w/reviews" element={<Guard role="worker"><Reviews/></Guard>}/>
            <Route path="/w/profile" element={<Guard role="worker"><Profile/></Guard>}/>
            <Route path="/w/skill-test" element={<Guard role="worker"><SkillTest/></Guard>}/>

            <Route path="/e/post" element={<Guard role="employer"><PostJob/></Guard>}/>
            <Route path="/e/jobs" element={<Guard role="employer"><PostedJobs/></Guard>}/>
            <Route path="/e/workers" element={<Guard role="employer"><BrowseWorkers/></Guard>}/>
            <Route path="/e/active" element={<Guard role="employer"><ActiveJobs/></Guard>}/>
            <Route path="/e/history" element={<Guard role="employer"><EmployerHistory/></Guard>}/>
            <Route path="/e/reviews" element={<Guard role="employer"><EmployerReviews/></Guard>}/>
            <Route path="/e/profile" element={<Guard role="employer"><EmployerProfile/></Guard>}/>

            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Routes>
          </NotificationProvider>
        </BrowserRouter>
      </AuthProvider>
    </LangProvider>
  );
}
