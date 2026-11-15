import "./motion.css";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        html { scroll-padding-top: 5rem; }
        @media (prefers-reduced-motion: no-preference) {
          html { scroll-behavior: smooth; }
        }
      `}</style>
      {children}
    </>
  );
}
