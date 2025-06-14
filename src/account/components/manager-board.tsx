import Header from "./header";
import Footer from "./footer";

interface ManagerPageProps {
  children: React.ReactNode;
}

export function ManagerBoard({ children }: ManagerPageProps) {
  return (
    <div className="flex flex-col justify-between items-stretch min-h-screen">
      <div>
        <Header />
        <div className="m-5 p-5 border border-gray-200 rounded-lg min-w-160">
          {children}
        </div>
      </div>
      <Footer />
    </div>
  );
}
