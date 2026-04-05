export default function QALayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-6 -mx-8 md:-mt-6 lg:-mx-12 -mt-20 h-[calc(100vh-0px)] md:h-screen">
      {children}
    </div>
  );
}
