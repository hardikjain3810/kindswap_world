import { Outlet } from "react-router-dom";
import Header from "../Header";
import Footer from "../Footer.tsx";

const AppLayout = () => {
  return (
    <div className="max-h-screen flex flex-col">
      <Header />

      {/* Main Page Content */}
      <main className="flex-1">
        <Outlet />
        {/* Footer */}
        <Footer />
      </main>


    </div>
  );
};

export default AppLayout;
