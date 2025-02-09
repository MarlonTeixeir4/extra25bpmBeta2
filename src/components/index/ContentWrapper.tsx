
import { ArrowLeft } from "lucide-react";

interface ContentWrapperProps {
  children: React.ReactNode;
  onBackClick: () => void;
}

const ContentWrapper = ({ children, onBackClick }: ContentWrapperProps) => {
  return (
    <div className="relative">
      <div className="absolute right-0 -top-12 mb-4">
        <button
          onClick={onBackClick}
          className="p-2 rounded-full hover:bg-white/80 transition-colors text-primary"
          aria-label="Voltar para home"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>
      {children}
    </div>
  );
};

export default ContentWrapper;
